# Day 2 — Compute (ALB & Auto Scaling)

## Objective

Deploy the Application Load Balancer (ALB) and an Auto Scaling Group (ASG) of EC2 instances running the DuoKart Flask app.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**Requires Day 1 VPC stack (`duokart-02-vpc`) to be running.**

---

## Prerequisites

- [x] VPC stack `duokart-02-vpc` deployed and `CREATE_COMPLETE`
- [x] NAT Gateway state = `Available`
- [x] Both contributors logged into AWS Console in `us-east-2`

---

## 1. Together — Write the Compute Template

Create `infra/02-compute.yaml` with the following resources:

### Resources to Build

| Resource | Purpose | Key Config |
|----------|---------|------------|
| ALB | Internet-facing load balancer | Public subnets, `alb-sg`, HTTP:80 |
| Target Group | Health check + routing | Port 5000, `/health` path, HTTP 200 |
| Listener | Forward HTTP traffic | Port 80 → Target Group |
| IAM Role | EC2 permissions | SSM + CloudWatch managed policies |
| Instance Profile | Attach IAM to EC2 | References IAM Role |
| Launch Template | EC2 configuration | Ubuntu 24.04, user-data bootstrap, `app-sg` |
| Auto Scaling Group | EC2 instances | 2 instances, public subnets, health check via ALB |

### Key Configuration Details

**ALB:**
- Scheme: `internet-facing`
- Subnets: Public Subnet 1 + Public Subnet 2 (from VPC stack)
- Security Group: `AlbSgId` (from VPC stack)

**Target Group:**
- Port: `5000` (Flask app)
- Protocol: `HTTP`
- Health Check Path: `/health`
- Health Check Interval: 30 seconds
- Healthy Threshold: 2 checks
- Unhealthy Threshold: 3 checks

**Launch Template:**
- AMI: `ami-0e5497a77ef21b5ac` (Ubuntu 24.04 in us-east-2)
- Instance Type: `t3.micro`
- Security Group: `AppSgId` (from VPC stack)
- IAM Instance Profile: from created IAM Role
- User-data: clone repo, install Python, create systemd service

**Auto Scaling Group:**
- Min: 2, Max: 4, Desired: 2
- Subnets: **Public Subnet 1 + Public Subnet 2** (see Troubleshooting below)
- Health Check Type: `ELB` (uses Target Group health check)
- Health Check Grace Period: 300 seconds

### User-Data Script (Launch Template)
```bash
#!/bin/bash
set -euxo pipefail

# System updates + Python
apt-get update -y
apt-get install -y python3 python3-pip python3-venv git

# Create app directory
mkdir -p /opt/duokart
cd /opt/duokart

# Clone app
git clone https://github.com/swapnilkumbhare04/duokart.git .

# Python venv + deps
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install flask gunicorn

# Install app-specific deps
if [ -f app/requirements.txt ]; then
  pip install -r app/requirements.txt
fi

# Create systemd service for Flask
cat > /etc/systemd/system/duokart.service << 'EOF'
[Unit]
Description=DuoKart Flask App
After=network.target

[Service]
User=root
WorkingDirectory=/opt/duokart/app
ExecStart=/opt/duokart/venv/bin/gunicorn -w 2 -b 0.0.0.0:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable duokart
systemctl start duokart
```

### Verify Template Locally (no AWS calls)
```bash
python -c "import yaml; yaml.safe_load(open('infra/02-compute.yaml')); print('YAML OK')"
```

---

## 2. Handoff Rule

Follow the pair programming handoff from `NEW-WORKFLOW.md`:

**Turn 1 (Swapnil):**
- Build ALB + Target Group + Listener + IAM Role
- Test and push directly to `main`

**Turn 2 (Prathamesh):**
- Pull from `main`
- Build Launch Template + Auto Scaling Group
- Test and push directly to `main`

**Result:** Both names appear in commit history with alternating commits.

---

## 3. Deploy via Console

### Steps
1. Open AWS Console → CloudFormation → Create stack → Upload a template file
2. Choose `infra/02-compute.yaml`
3. Region: `us-east-2` (Ohio)
4. Stack name: `duokart-02-compute`
5. Parameters:
   - `VpcStackName`: `duokart-02-vpc` (default)
   - `EnvironmentName`: `dev` (default)
6. Click Create stack → wait for Status `CREATE_COMPLETE`

### What to Watch For
- ALB creation takes ~2 minutes
- IAM Role/Profile creation is instant
- Launch Template creation is instant
- ASG creates 2 EC2 instances (takes ~3-4 minutes)
- Target Group health check takes ~1-2 minutes after instances boot
- Total deploy time: ~8-12 minutes

---

## 4. Verify the Deployment

### CloudFormation Verification
- [x] Stack Status = `CREATE_COMPLETE` (no `ROLLBACK` events)
- [x] Outputs tab shows:
  - `AlbDnsName` (copy this to browser)
  - `AlbArn`
  - `TargetGroupArn`
  - `ListenerArn`

### ALB Verification
- [x] EC2 → Load Balancers → `duokart-dev-alb` state = `active`
- [x] Scheme = `internet-facing`
- [x] DNS name works in browser (shows "DuoKart is live!")

### Target Group Verification
- [x] EC2 → Target Groups → `duokart-dev-tg`
- [x] Targets tab: 2 instances, both `healthy`
- [x] Health check path: `/health`

### EC2 Verification
- [x] EC2 → Instances → 2 running instances named `duokart-dev-app`
- [x] Both in `running` state
- [x] Both pass status checks

---

## 5. Troubleshooting

### Issue: 502 Bad Gateway when accessing ALB DNS

**Root cause:** Auto Scaling Group was placed in **private subnets**. Instances in private subnets route internet traffic through NAT Gateway. The user-data script runs `apt-get` and `git clone` which need internet access. NAT Gateway routing was not configured correctly for this traffic.

**Solution:**
1. Go to EC2 → Auto Scaling Groups → `duokart-dev-asg`
2. Click Edit → VPC subnet dropdown
3. Change from Private Subnets to **Public Subnets**
4. Save → instances terminate and relaunch in public subnets
5. After instances boot and pass health check, ALB returns 200

**Lesson learned:** For user-data scripts that need internet access (apt-get, git clone), instances must be in public subnets with a public IP, OR private subnets with correctly configured NAT Gateway routing.

### Issue: Stack name `duokart-01-vpc` not found

**Root cause:** VPC stack was deployed as `duokart-02-vpc` (after rollback on first attempt with `duokart-01-vpc`).

**Solution:** Ensure `VpcStackName` parameter defaults to `duokart-02-vpc`.

### Issue: Targets showing as `unhealthy`

**Root cause:** Flask app not running on port 5000, or `/health` endpoint not responding.

**Solution:**
1. SSH to instance via Session Manager (EC2 → Instances → Connect → Session Manager)
2. Check service status: `systemctl status duokart`
3. Check logs: `journalctl -u duokart -f`
4. Verify app listens on port 5000: `ss -tlnp | grep 5000`

---

## 6. Evidence Required

Screenshot the following and commit directly to `main`:

| # | What | Where to Find | Filename |
|---|------|---------------|----------|
| 1 | App live in browser | Visit ALB DNS URL | `app-live.png` |
| 2 | ALB details | EC2 → Load Balancers → duokart-dev-alb | `lb-dns.png` |
| 3 | ALB resource map | Load Balancers → Resource map tab | `lb-healthy.png` |
| 4 | Stack complete | CloudFormation → duokart-02-compute → stack info | `stack-complete.png` |

Save screenshots to `docs/screenshots/day-2/` and push directly to `main`.

---

## 7. Cost Impact

| Resource | Hourly Cost | Daily Cost | Notes |
|----------|-------------|------------|-------|
| ALB | ~$0.0225/hr | ~$0.54/day | Fixed hourly charge |
| 2x t3.micro | ~$0.021/hr each | ~$0.50/day | ~$0.25/instance |
| NAT Gateway | ~$0.045/hr | ~$1.08/day | From Day 1, kept running |
| **Total** | **~$0.089/hr** | **~$2.12/day** | ALB + EC2 + NAT |

**Nightly policy:** Delete `duokart-02-compute` each evening. Keep VPC (`duokart-02-vpc`) up all week.

---

## 8. Nightly Teardown

1. CloudFormation → select `duokart-02-compute` → Delete stack
2. Wait for deletion to complete (~2-3 minutes)
3. CloudFormation → select `duokart-02-vpc` → Delete stack
4. Wait for deletion to complete (~3-5 minutes)
5. Verify: EC2 → Instances → 0 running
6. Verify: VPC → NAT Gateways → 0 active

---

## 9. Definition of Done

- [x] `infra/02-compute.yaml` written and YAML-validated locally
- [x] Template pushed directly to `main`
- [x] Stack deployed as `duokart-02-compute` in `us-east-2`
- [x] Stack Status = `CREATE_COMPLETE`
- [x] ALB serves traffic at DNS URL (shows "DuoKart is live!")
- [x] Target Group shows 2 healthy targets
- [x] 4 screenshots captured and committed
- [x] Troubleshooting notes filled (if issues encountered)
- [x] Cost impact documented

---

## Day 3 Starting Point

Data tier: RDS MySQL Multi-AZ. See `docs/day-3-data.md` (when created).

**What you'll need from today:**
- ALB DNS name (for app URL)
- Target Group ARN (for future integrations)
- VPC stack name: `duokart-02-vpc` (for RDS subnet group)
- Private subnet IDs (for RDS placement)
- App Security Group ID (for RDS inbound rule)
