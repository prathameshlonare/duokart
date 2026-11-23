# RUNBOOK 01: ALB Target Health, Socket Binding, and 5xx Triage

* **Severity**: High (P1/P2)
* **Affected Components**: Application Load Balancer (ALB), Target Groups, Gunicorn Application Daemon
* **Primary Metric**: `AWS/ApplicationELB` `HTTPCode_ELB_502_Count` / `UnHealthyHostCount`

---

## 1. Alert Trigger & Incident Symptoms

This runbook activates when CloudWatch raises one of the following alarms:
* `duokart-dev-alb-5xx`: `HTTPCode_Target_5XX_Count > 10` for 5 minutes.
* `duokart-dev-alb-unhealthy`: `UnHealthyHostCount > 0` for 2 consecutive 1-minute periods.
* End users report intermittent or immediate **HTTP 502 Bad Gateway** or **HTTP 504 Gateway Timeout**.

---

## 2. Theoretical Breakdown: 502 vs 504 Failure Modes

| Status Code | Error Name | Exact Network / Kernel Event | Common Root Cause |
| :--- | :--- | :--- | :--- |
| **HTTP 502** | Bad Gateway | The ALB attempted to establish a TCP connection to the backend EC2 target, but received an immediate **TCP RST (Reset)** packet or the connection was abruptly closed before response headers arrived. | Daemon bound strictly to localhost (`127.0.0.1`), application crashed on boot, or target security group blocked port 5000. |
| **HTTP 504** | Gateway Timeout | The TCP handshake succeeded, but the target failed to return HTTP response headers within the ALB **Idle Timeout** window (default 60 seconds). | Blocked database queries, unindexed table scans on RDS, or thread starvation in Gunicorn workers. |

---

## 3. Immediate Diagnostic Flowchart

```
[Alarm: 502 Bad Gateway Spike]
         │
         ▼
[Check Target Group Health Code in AWS Console / CLI]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[Code: Target.FailedHealthChecks]        [Code: Target.Timeout]
         │                                         │
         ▼                                         ▼
[Connect via SSM Session Manager]        [Inspect Slow Queries]
         │                               Check RDS CPU & Locks
         ▼
[Check Listening Sockets: ss -tlnp]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[Listening on 127.0.0.1:5000]             [Process Not Running]
Localhost Trap: Kernel drops SYN         Check journalctl -u duokart
         │                               Fix Python syntax/crash
         ▼
[Rebind to 0.0.0.0:5000 & Restart]
```

---

## 4. Empirical Fault-Injection Evidence

### Step 1: The Localhost Trap (How the Failure Occurs)
If the Gunicorn application server binds to `127.0.0.1` instead of `0.0.0.0`, the Linux kernel restricts listening sockets exclusively to the loopback (`lo`) virtual network interface:

```text
(venv) $ gunicorn --workers 2 --bind 127.0.0.1:5000 app:app --daemon
```

Inspecting the kernel socket table via `ss` reveals the bound interface:

```text
(venv) $ ss -tlnp | grep 5000
LISTEN 0      2048        127.0.0.1:5000      0.0.0.0:*    users:(("gunicorn",pid=1628,fd=3),("gunicorn",pid=1627,fd=3),("gunicorn",pid=1626,fd=3))
```

Testing localhost succeeds with `200 OK`:
```text
(venv) $ curl -I http://127.0.0.1:5000/health
HTTP/1.1 200 OK
Server: gunicorn
Date: Mon, 23 Nov 2026 16:36:14 GMT
Content-Type: application/json
Content-Length: 183
```

### Step 2: The ALB Health Check Rejection (The 502 Smoking Gun)
An ALB routes traffic over the VPC network interface (`eth0`) using the EC2 instance's private IP (`172.17.8.140`). When probed, the kernel finds no listener on that interface and immediately rejects the TCP SYN packet with a **TCP RST**:

```text
(venv) $ PRIVATE_IP=$(hostname -I | awk '{print $1}') && curl -Iv "http://$PRIVATE_IP:5000/health"
Target Private IP: 172.17.8.140
*   Trying 172.17.8.140:5000...
* connect to 172.17.8.140 port 5000 from 172.17.8.140 port 56076 failed: Connection refused
* Failed to connect to 172.17.8.140 port 5000 after 0 ms: Couldn't connect to server
* Closing connection
curl: (7) Failed to connect to 172.17.8.140 port 5000 after 0 ms: Couldn't connect to server
```

The `Connection refused after 0 ms` response causes the ALB Target Group to mark the instance `Unhealthy` (`Target.FailedHealthChecks`), producing immediate client-side **HTTP 502 Bad Gateway** errors.

---

## 5. Triage & Resolution Procedure

### Step 1: Connect to the Failing Target
Open a browser terminal via AWS Systems Manager Session Manager (zero SSH keys required):
```bash
aws ssm start-session --target <INSTANCE_ID>
```

### Step 2: Check Service Status and Logs
```bash
systemctl status duokart.service
journalctl -u duokart.service -n 50 --no-pager
```

### Step 3: Apply the Socket Fix
Ensure `/etc/systemd/system/duokart.service` specifies `0.0.0.0:5000` (`INADDR_ANY`), instructing the kernel to listen across all network interfaces:

```ini
[Unit]
Description=DuoKart Flask App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/duokart/app
ExecStart=/opt/duokart/venv/bin/gunicorn --workers 2 --bind 0.0.0.0:5000 app:app
Restart=always
RestartSec=3s

[Install]
WantedBy=multi-user.target
```

Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart duokart.service
```

### Step 4: Verify Socket Binding & Private IP Response
Verify that the socket is listening on all interfaces:
```text
(venv) $ ss -tlnp | grep 5000
LISTEN 0      2048          0.0.0.0:5000      0.0.0.0:*    users:(("gunicorn",pid=1656,fd=3),("gunicorn",pid=1655,fd=3),("gunicorn",pid=1652,fd=3))
```

Re-probe the private IP address:
```text
(venv) $ PRIVATE_IP=$(hostname -I | awk '{print $1}') && curl -Iv "http://$PRIVATE_IP:5000/health"
*   Trying 172.17.8.140:5000...
* Connected to 172.17.8.140 (172.17.8.140) port 5000
> HEAD /health HTTP/1.1
> Host: 172.17.8.140:5000
> User-Agent: curl/8.5.0
> Accept: */*
>
< HTTP/1.1 200 OK
< Server: gunicorn
< Content-Type: application/json
< Content-Length: 183
```

---

## 6. Post-Incident Verification & Security Hardening

1. **Target Group Health Check Verification**: Check the AWS Console under **EC2 $\rightarrow$ Target Groups $\rightarrow$ duokart-dev-tg $\rightarrow$ Targets**. Verify status transitions from `Unhealthy` to `Healthy` (2 consecutive checks required per template config).
2. **Security Group Least Privilege**: While Gunicorn listens on `0.0.0.0:5000`, verify that `duokart-app-sg` restricts inbound port 5000 traffic **strictly** to the security group ID of the ALB (`duokart-alb-sg`), preventing direct public exposure.
3. **CloudWatch Alarm Clearance**: Verify that `HTTPCode_Target_5XX_Count` returns to 0 and CloudWatch alarm states return to `OK`.
