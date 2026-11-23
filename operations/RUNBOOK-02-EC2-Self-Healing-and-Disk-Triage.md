# RUNBOOK 02: Linux Storage Exhaustion & Auto Scaling Recovery

* **Severity**: High (P1/P2)
* **Affected Components**: EC2 Compute Nodes, Linux Ext4 Filesystem, Auto Scaling Group (ASG), ALB Target Group
* **Primary Metric**: `disk_used_percent` / `disk_inodes_used_percent` / `Target.FailedHealthChecks`

---

## 1. Alert Trigger & Incident Symptoms

This runbook activates when:
* CloudWatch custom metric alarm fires: `disk_inodes_used_percent > 85%` or `disk_used_percent > 90%`.
* Application logs report: `IOError: [Errno 28] No space left on device`.
* The Target Group flags an EC2 instance as `Unhealthy`, triggering automated ASG node termination.
* Engineers cannot log in or applications fail to generate temporary session files, PID files, or socket endpoints.

---

## 2. Mechanical Breakdown: Blocks vs Inodes vs Unlinked Files

A Linux filesystem manages storage through two separate resource pools:

1. **Data Blocks (Storage Volume)**: Represents the actual bytes written to disk (measured by `df -h`). Exhausted by large files (database dumps, uncompressed logs).
2. **Inodes (Index Nodes)**: Data structures storing file metadata (owner, file mode, timestamps, block pointers). Measured by `df -i`. Every file and directory consumes exactly one inode regardless of file size.
3. **The Inode Exhaustion Paradox**: When an application generates millions of zero-byte session, cache, or temporary files, the system exhausts 100% of its available inodes while `df -h` shows gigabytes of free disk space.
4. **The Unlinked Open File Trap (`lsof +L1`)**: Deleting an active log file (`rm app.log`) while a process is running removes its directory entry, but the Linux kernel does not release the underlying disk blocks until the file descriptor is closed. `df -h` shows 100% disk usage, while `du -sh` cannot locate the space.

---

## 3. Immediate Diagnostic Flowchart

```
[Alarm: Storage Alert or Instance Unhealthy]
                     │
                     ▼
        [Connect via Session Manager]
                     │
                     ▼
          [Run: df -h vs df -i]
                     │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[df -h reads 100% Full]                 [df -i reads 100% Full]
Block Storage Exhaustion                Inode Exhaustion Paradox
Check large files & unlinked fds        (Block space reads 0% Used)
         │                                         │
         ├──────────────────────┐                  ▼
         ▼                      ▼         [Run: find command to locate]
[Check lsof +L1]       [du -sh /*]        [Directory with millions of files]
Restart process holding unlinked fds               │
                                                   ▼
                                          [Purge via find -delete]
```

---

## 4. Empirical Fault-Injection Evidence

### Step 1: The Inode Exhaustion Injection
Using a bounded test filesystem with an explicit inode ceiling (`nr_inodes=1000` on 10MB space), we injected 1,005 zero-byte session files to simulate an unrotated application session leak:

```bash
sudo bash -c 'for i in $(seq 1 1005); do touch /mnt/inode-demo/session_$i.tmp; done'
```

At file 1000, the Linux kernel syscall `creat()` returned `ENOSPC`:

```text
touch: cannot touch '/mnt/inode-demo/session_1000.tmp': No space left on device
touch: cannot touch '/mnt/inode-demo/session_1001.tmp': No space left on device
touch: cannot touch '/mnt/inode-demo/session_1002.tmp': No space left on device
touch: cannot touch '/mnt/inode-demo/session_1003.tmp': No space left on device
touch: cannot touch '/mnt/inode-demo/session_1004.tmp': No space left on device
touch: cannot touch '/mnt/inode-demo/session_1005.tmp': No space left on device
```

### Step 2: The Block vs Inode Paradox
Inspecting the storage state immediately reveals the classic production trap:

```text
(venv) $ df -h /mnt/inode-demo && df -i /mnt/inode-demo
Filesystem      Size  Used Avail Use% Mounted on
tmpfs            10M     0   10M   0% /mnt/inode-demo
Filesystem     Inodes IUsed IFree IUse% Mounted on
tmpfs            1000  1000     0  100% /mnt/inode-demo
```

* **`df -h`**: Reports **10 MB free space (0% used)**.
* **`df -i`**: Reports **0 free inodes (100% exhausted)**.

### Step 3: Forensic Directory Identification
When an on-call engineer checks standard disk metrics, everything appears green, but all write syscalls fail. Running the forensic directory scanner pinpoints the source of the file flood:

```text
(venv) $ sudo find /mnt/inode-demo -type f | wc -l
999
```

---

## 5. Triage & Mitigation Procedure

### Step 1: Connect via AWS Systems Manager
```bash
aws ssm start-session --target <INSTANCE_ID>
```

### Step 2: Check Both Storage Dimensions
```bash
df -h
df -i
```

### Step 3: Detect Unlinked Open File Descriptors
If `df -h` shows 100% disk usage but `du -sh /*` reports low usage, query the kernel for unlinked open files held by running processes:
```bash
lsof +L1
```
* **Resolution**: Identify the process holding the unlinked file descriptor (PID) and restart the service (e.g. `systemctl restart duokart`).

### Step 4: Pinpoint Inode-Heavy Directories
Run this pipeline across the root filesystem to find the top 10 directories consuming inodes:
```bash
find / -xdev -type f | cut -d "/" -f 2,3 | sort | uniq -c | sort -nr | head -n 10
```

### Step 5: Safe Bulk File Purge
Attempting to run `rm -rf *` inside a directory containing 500,000+ files will fail with `bash: /bin/rm: Argument list too long`. Use `find` with `-delete` to process files in kernel stream batches:
```bash
find /tmp/app-sessions/ -type f -name "*.tmp" -mtime +2 -delete
```

---

## 6. Auto Scaling Group Self-Healing & Connection Draining Lifecycle

When inode or block exhaustion prevents an EC2 instance from writing PID/session files, Gunicorn crashes and the instance fails health checks (`/health`).

DuoKart implements automated self-healing via the AWS ALB and Auto Scaling Group:

```
[Instance Fails /health Check]
              │
              ▼
[ALB Target Status -> DRAINING]
              │
              ▼
[Deregistration Delay Window: 300s]
Existing in-flight requests complete (HTTP 200)
Zero new requests routed to failing target
              │
              ▼
[Auto Scaling Group Initiates Termination]
Unhealthy EC2 instance terminated
              │
              ▼
[Auto Scaling Group Launches Replacement]
Launch Template executes User Data bootstrap
              │
              ▼
[Target Status -> HEALTHY]
Fresh instance registers with Target Group
```

1. **Connection Draining (Deregistration Delay)**: The ALB sets the target status to `Draining`. Existing in-flight HTTP connections have 300 seconds to conclude. No new traffic is forwarded to the node.
2. **Automated Replacement**: The ASG terminates the failed instance and boots a fresh EC2 instance from the Launch Template.
3. **Recovery Verification**: User Data pulls application code from Git, launches the systemd service, and registers the node back into `duokart-dev-tg` in `Healthy` state.

---

## 7. Permanent Prevention Measures

1. **CloudWatch Agent Inode Metrics**: Include `disk_inodes_used_percent` in `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json` and alarm at 80%.
2. **Logrotate Enforcement**: Ensure all application logs in `/var/log/duokart/` are rotated daily and compressed with a 7-day retention limit.
3. **Session Auto-Purge Cron**: Configure a systemd timer to purge expired temporary session tokens from `/tmp` every 6 hours.
