# Day 3 — Data Tier (RDS MySQL)

## Objective

Deploy Amazon RDS MySQL Multi-AZ database for DuoKart products, orders, and users tables. Store DB password in SSM Parameter Store. Update Flask app to connect to RDS.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**Requires Day 1 VPC stack (`duokart-02-vpc`) and Day 2 compute stack (`duokart-02-compute`) to be running.**

---

## Prerequisites

- [x] VPC stack `duokart-01-vpc` deployed and `CREATE_COMPLETE` (standardized 2026-09-17)
- [x] Compute stack `duokart-02-compute` deployed and `CREATE_COMPLETE`
- [x] Both contributors logged into AWS Console in `us-east-2`

---

## 1. Together — Write the Data Template

Create `infra/03-data.yaml` with the following resources:

### Resources to Build

| Resource | Purpose | Key Config |
|----------|---------|------------|
| DB Subnet Group | RDS subnet placement | Private Subnet 1 + Private Subnet 2 |
| RDS MySQL Instance | Primary database | Multi-AZ, `db.t3.micro`, MySQL 8.0 |
| SSM Parameter | Store DB password | SecureString, no hardcoded passwords |
| Outputs | Export DB endpoint, port, name | For app connection |

### Key Configuration Details

**RDS MySQL Instance:**
- DB Instance Identifier: `duokart-dev-db`
- Engine: MySQL 8.0
- Engine Version: `8.0.35`
- DB Instance Class: `db.t3.micro` (free tier eligible)
- Storage: 20 GB GP3, auto-scaling enabled
- Multi-AZ: **Yes** (production failover)
- Master Username: `duokart_admin`
- Master Password: From SSM Parameter Store
- VPC Security Groups: `DbSgId` (from VPC stack — allows 3306 from `app-sg` only)
- Publicly Accessible: **No** (private subnets only)
- Backup Retention: 7 days
- Deletion Protection: **No** (for nightly teardown)
- Skip Final Snapshot: **Yes** (dev environment)

**DB Subnet Group:**
- Description: `duokart-dev-db-subnet-group`
- VPC: from VPC stack
- Subnets: Private Subnet 1 + Private Subnet 2 (both AZs)

**SSM Parameter:**
- Name: `/duokart/dev/db-password`
- Type: `SecureString`
- Value: Generated password (16+ chars, alphanumeric + symbols)
- Description: `DuoKart dev RDS master password`

### Password Generation

Generate a secure password before deploying:
```bash
# Linux/Mac
openssl rand -base64 16

# Or use AWS Console: SSM → Parameter Store → Create parameter
```

**IMPORTANT:** Save this password temporarily — you'll need it for the SSM parameter. Never commit passwords to git.

### Verify Template Locally (no AWS calls)
```bash
python -c "import yaml; yaml.safe_load(open('infra/03-data.yaml')); print('YAML OK')"
```

---

## 2. Handoff Rule

Follow the pair programming handoff from `NEW-WORKFLOW.md`:

**Turn 1 (Swapnil):**
- Build DB Subnet Group + RDS Instance
- Create SSM Parameter for DB password
- Test and push directly to `main`

**Turn 2 (Prathamesh):**
- Pull from `main`
- Build Outputs (endpoint, port, DB name)
- Update `app/app.py` to connect to RDS
- Test and push directly to `main`

**Result:** Both names appear in commit history with alternating commits.

---

## 3. Deploy via Console

### Steps
1. Open AWS Console → CloudFormation → Create stack → Upload a template file
2. Choose `infra/03-data.yaml`
3. Region: `us-east-2` (Ohio)
4. Stack name: `duokart-03-data`
5. Parameters:
   - `VpcStackName`: `duokart-02-vpc` (default)
   - `EnvironmentName`: `dev` (default)
   - `DBPassword`: *(paste from SSM or generate)*
6. Click Create stack → wait for Status `CREATE_COMPLETE`

### What to Watch For
- DB Subnet Group creation: ~1 minute
- RDS instance creation: **~10-15 minutes** (longest step)
- SSM Parameter creation: ~30 seconds
- Total deploy time: ~15-20 minutes

**Note:** RDS takes much longer than other resources. Be patient — the instance must be fully available before the app can connect.

---

## 4. Verify the Deployment

### CloudFormation Verification
- [x] Stack Status = `CREATE_COMPLETE` (no `ROLLBACK` events)
- [x] Outputs tab shows:
  - `DBEndpoint` (RDS endpoint URL)
  - `DBPort` (3306)
  - `DBName` (duokart)
  - `SSMParameterName` (/duokart/dev/db-password)

### RDS Console Verification
- [x] RDS → Databases → `duokart-dev-db` status = `Available`
- [x] Engine: MySQL 8.0.x
- [x] Instance class: `db.t3.micro`
- [x] Multi-AZ: Yes
- [x] Publicly accessible: No
- [x] VPC: DuoKart VPC
- [x] Subnet group: uses private subnets

### SSM Parameter Verification
- [x] SSM → Parameter Store → `/duokart/dev/db-password` exists
- [ ] Type: SecureString
- [x] Value is encrypted (not visible in console)

### App Connection Test
- [x] Update `app/app.py` with RDS connection string
- [x] Restart Flask app: `sudo systemctl restart duokart`
- [x] Test endpoint: `curl http://<ALB-DNS>/health` returns 200
- [x] Test DB: `curl http://<ALB-DNS>/products` returns product list (or empty array)

---

## 5. Update Flask App for RDS Connection

### Add to `app/app.py`

```python
import os
import pymysql
from flask import Flask, jsonify

app = Flask(__name__)

# Database configuration
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', 3306))
DB_USER = os.environ.get('DB_USER', 'duokart_admin')
DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
DB_NAME = os.environ.get('DB_NAME', 'duokart')

def get_db_connection():
    """Create database connection."""
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

@app.route('/')
def home():
    return jsonify({"message": "DuoKart is live!"})

@app.route('/health')
def health():
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({"status": "healthy", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 503

@app.route('/products')
def get_products():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM products")
            products = cursor.fetchall()
        conn.close()
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

### Add to `app/requirements.txt`

```
flask
gunicorn
pymysql
cryptography  # Required for PyMySQL SSL
```

### Set Environment Variables in User-Data

Update the Launch Template user-data to include DB connection:

```bash
# Add to /etc/systemd/system/duokart.service
[Service]
Environment="DB_HOST=<RDS_ENDPOINT>"
Environment="DB_PORT=3306"
Environment="DB_USER=duokart_admin"
Environment="DB_PASSWORD=<SSM_PARAMETER_VALUE>"
Environment="DB_NAME=duokart"
```

**Alternative:** Use IAM role to fetch password from SSM at runtime (more secure).

---

## 6. Troubleshooting

### Issue: RDS creation takes forever

**Root cause:** RDS Multi-AZ instances take 10-15 minutes to provision. This is normal — AWS must provision primary and standby instances in different AZs.

**Solution:** Wait patiently. Check Events tab for progress. Do not delete and recreate — this wastes time.

### Issue: App cannot connect to RDS

**Root cause:** Security Group misconfiguration or wrong endpoint.

**Solution:**
1. Verify `DbSgId` allows inbound 3306 from `AppSgId` (not from `0.0.0.0/0`)
2. Verify RDS is in private subnets (not public)
3. Verify correct endpoint in app environment variables
4. Test connectivity from EC2 instance: `telnet <RDS_ENDPOINT> 3306`

### Issue: Password authentication failed

**Root cause:** Wrong password or SSM parameter not retrieved correctly.

**Solution:**
1. Verify SSM parameter name: `/duokart/dev/db-password`
2. Test password manually: `mysql -h <RDS_ENDPOINT> -u duokart_admin -p`
3. If password is wrong, update SSM parameter and restart app

### Issue: RDS in public subnets

**Root cause:** DB Subnet Group was created with public subnets instead of private.

**Solution:**
1. RDS → Subnet groups → `duokart-dev-db-subnet-group`
2. Edit → Remove public subnets → Add private subnets
3. Must recreate RDS instance (unfortunately, no in-place subnet change)

---

## 7. Evidence Required

Screenshot the following and commit directly to `main`:

| # | What | Where to Find | Filename |
|---|------|---------------|----------|
| 1 | Stack complete | CloudFormation → duokart-03-data → stack info | `stack-complete.png` |
| 2 | RDS details | RDS → Databases → duokart-dev-db | `rds-details.png` |
| 3 | RDS connectivity | RDS → Connectivity & security tab | `rds-connectivity.png` |
| 4 | SSM parameter | SSM → Parameter Store → /duokart/dev/db-password | `ssm-parameter.png` |
| 5 | App health check | Visit ALB DNS URL /health | `app-health-db.png` |

Save screenshots to `docs/screenshots/day-3/` and push directly to `main`.

---

## 8. Cost Impact

| Resource | Hourly Cost | Daily Cost | Notes |
|----------|-------------|------------|-------|
| RDS `db.t3.micro` Multi-AZ | ~$0.035/hr | ~$0.84/day | Biggest single burner |
| RDS Storage (20GB GP3) | ~$0.002/hr | ~$0.05/day | Minimal |
| SSM Parameter | Free | Free | No charge for standard parameters |
| NAT Gateway | ~$0.045/hr | ~$1.08/day | From Day 1, kept running |
| ALB | ~$0.0225/hr | ~$0.54/day | From Day 2, kept running |
| 2x t3.micro | ~$0.021/hr each | ~$0.50/day | From Day 2, kept running |
| **Total** | **~$0.126/hr** | **~$3.01/day** | RDS + ALB + EC2 + NAT |

**Nightly policy:** Delete `duokart-03-data` and `duokart-02-compute` each evening. Keep VPC (`duokart-02-vpc`) up all week.

---

## 9. Nightly Teardown

1. CloudFormation → select `duokart-03-data` → Delete stack
2. Wait for deletion to complete (~5-10 minutes — RDS takes time)
3. CloudFormation → select `duokart-02-compute` → Delete stack
4. Wait for deletion to complete (~2-3 minutes)
5. CloudFormation → select `duokart-02-vpc` → Delete stack
6. Wait for deletion to complete (~3-5 minutes)
7. Verify: RDS → Databases → 0 instances
8. Verify: EC2 → Instances → 0 running
9. Verify: VPC → NAT Gateways → 0 active

---

## 10. Definition of Done

- [x] `infra/03-data.yaml` written and YAML-validated locally
- [x] Template pushed directly to `main`
- [x] Stack deployed as `duokart-03-data` in `us-east-2`
- [x] Stack Status = `CREATE_COMPLETE`
- [x] RDS instance status = `Available`
- [x] SSM Parameter created and encrypted
- [x] App connects to RDS (health check returns 200)
- [x] 5 screenshots captured and committed
- [x] Troubleshooting notes filled (if issues encountered)
- [x] Cost impact documented

---

## Day 4 Starting Point

Storage tier: S3 buckets for photos and bills. See `docs/day-4-storage.md`.

**What you'll need from today:**
- RDS endpoint (for app connection)
- DB name and port (for app configuration)
- VPC stack name: `duokart-01-vpc` (for S3 access via IAM)
- App Security Group ID (already in use)
