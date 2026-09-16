# Day 1 — Custom VPC (Network Foundation)

## Objective

Build the private network foundation for DuoKart: custom VPC with public/private subnets across 2 AZs, internet gateway, 1 NAT gateway, and layered security groups.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**No application infrastructure today.** Do not create: EC2 instances, ALB, ASG, RDS, Lambda, SQS, DynamoDB. Network only.

---

## Prerequisites

- [x] Day 0 complete: repo exists, both IAM logins work, budgets configured.
- [x] Both contributors logged into AWS Console in `us-east-2`.

---

## 1. Together — Write the VPC Template

Create `infra/01-vpc.yaml` with the following resources:

### Network Layout

| Resource | CIDR | AZ | Purpose |
|----------|------|----|---------|
| VPC | `10.0.0.0/16` | — | Main network |
| Public Subnet 1 | `10.0.1.0/24` | us-east-2a | ALB, NAT Gateway, Bastion |
| Public Subnet 2 | `10.0.2.0/24` | us-east-2b | ALB second leg |
| Private Subnet 1 | `10.0.11.0/24` | us-east-2a | App servers, RDS |
| Private Subnet 2 | `10.0.12.0/24` | us-east-2b | App servers, RDS |

### Security Groups

| SG Name | Inbound | Outbound | Purpose |
|---------|---------|----------|---------|
| `alb-sg` | 80/443 from `0.0.0.0/0` | All | Internet-facing ALB |
| `app-sg` | 5000 from `alb-sg` only | All | Flask app (ALB → EC2) |
| `db-sg` | 3306 from `app-sg` only | All | MySQL (EC2 → RDS) |
| `bastion-sg` | 22 from admin IP only | All | SSH jump server |

### Key Resources
- [x] VPC with `Project=DuoKart, Environment=dev, ManagedBy=CloudFormation` tags
- [x] Internet Gateway attached to VPC
- [x] 1 NAT Gateway in Public Subnet 1 (cost decision: single NAT ~$1/day vs dual NAT ~$2/day)
- [x] Public route table (0.0.0.0/0 → IGW) associated with both public subnets
- [x] Private route table (0.0.0.0/0 → NAT) associated with both private subnets
- [x] 4 Security Groups with correct cross-references
- [x] 10 Outputs: VpcId, 4 subnet IDs, 4 SG IDs, NAT Gateway ID

### Verify Template Locally (no AWS calls)
```bash
python -c "import yaml; yaml.safe_load(open('infra/01-vpc.yaml')); print('YAML OK')"
```
Expected: prints `YAML OK` with no errors.

---

## 2. Together — Deploy via Console

### Steps
1. Open AWS Console → CloudFormation → Create stack → Upload a template file
2. Choose `infra/01-vpc.yaml`
3. Region: `us-east-2` (Ohio)
4. Stack name: `duokart-02-vpc` (see Troubleshooting below for why not `duokart-01-vpc`)
5. Parameters: keep defaults (`dev`, CIDRs as planned)
6. Click Create stack → wait for Status `CREATE_COMPLETE` (refresh Events tab)

### What to Watch For
- Events tab shows each resource being created in order
- NAT Gateway may take 2-3 minutes to become `Available`
- Total deploy time: ~5-8 minutes

---

## 3. Together — Verify the Deployment

### CloudFormation Verification
- [x] Stack Status = `CREATE_COMPLETE` (no `ROLLBACK` events)
- [x] Outputs tab shows 10 values:
  - `VpcId` (starts with `vpc-`)
  - `PublicSubnet1Id`, `PublicSubnet2Id` (start with `subnet-`)
  - `PrivateSubnet1Id`, `PrivateSubnet2Id`
  - `AlbSgId`, `AppSgId`, `DbSgId`, `BastionSgId`
  - `NatGatewayId`

### Console Verification
- [x] VPC console: 1 VPC with `Project=DuoKart` tag
- [x] Subnets console: 4 subnets (2 public, 2 private) across 2 AZs
- [x] NAT Gateway console: 1 NAT Gateway state = `Available`
- [x] EC2 console: 0 running instances
- [x] RDS console: 0 databases

---

## 4. Troubleshooting

### Issue: Stack name `duokart-01-vpc` rolled back on first attempt

**Root cause:** Security Group description field has a charset limitation in CloudFormation. The initial template had a description that triggered a rollback.

**Solution:** 
1. Fixed the SG description in the template
2. Changed stack name to `duokart-02-vpc` for the retry
3. All exports are now `duokart-02-vpc-*` (not `duokart-01-vpc-*`)

**Lesson learned:** When CloudFormation rolls back, check the Events tab for the exact error. The stack name can be reused after fixing the template.

### Issue: Exports not found in Day 2

**Root cause:** Day 2 template imports using `${VpcStackName}-SubnetId` but the actual export names are `duokart-02-vpc-SubnetId`.

**Solution:** Ensure `VpcStackName` parameter in Day 2 template defaults to `duokart-02-vpc` (not `duokart-01-vpc`).

---

## 5. Evidence Required

Screenshot the following and commit directly to `main`:

| # | What | Where to Find | Filename |
|---|------|---------------|----------|
| 1 | Stack Outputs tab | CloudFormation → duokart-02-vpc → Outputs | `stack-outputs.png` |
| 2 | VPC console | VPC → Your VPCs → filter by `DuoKart` | `vpc-console.png` |
| 3 | Subnets console | VPC → Subnets → show all 4 | `subnets-console.png` |
| 4 | NAT Gateway | VPC → NAT Gateways → state = Available | `nat-gateway.png` |
| 5 | Empty EC2 | EC2 → Instances → 0 running | `ec2-empty.png` |
| 6 | Empty RDS | RDS → Databases → 0 databases | `rds-empty.png` |

Save screenshots to `docs/screenshots/day-1/` and push directly to `main`.

---

## 6. Cost Impact

| Resource | Hourly Cost | Daily Cost | Notes |
|----------|-------------|------------|-------|
| NAT Gateway | ~$0.045/hr | ~$1.08/day | Biggest Day-1 burner |
| VPC + Subnets | Free | Free | No hourly charge |
| Security Groups | Free | Free | No hourly charge |
| **Total** | **~$0.045/hr** | **~$1.08/day** | Keep up all week if building consecutively |

**Nightly policy:** Keep VPC stack up all week (rebuilding takes ~5 min). Delete only if not building for 24h+.

---

## 7. Definition of Done

- [x] `infra/01-vpc.yaml` written and YAML-validated locally
- [x] Template pushed directly to `main`
- [x] Stack deployed as `duokart-02-vpc` in `us-east-2`
- [x] Stack Status = `CREATE_COMPLETE`
- [x] All 10 Outputs verified
- [x] 6 screenshots captured and committed
- [x] Zero EC2/RDS instances running
- [x] Cost impact documented
- [x] Troubleshooting notes filled (if issues encountered)

---

## Day 2 Starting Point

Compute tier: ALB + Auto Scaling Group. See `docs/day-2-compute.md`.

**What you'll need from today:**
- Stack name: `duokart-02-vpc` (for `Fn::ImportValue` in Day 2 template)
- Public subnet IDs (for ALB placement)
- Private subnet IDs (for ASG placement — or public if NAT routing is an issue)
- ALB Security Group ID (for ALB creation)
- App Security Group ID (for Launch Template)

No Day 1 item left open before starting Day 2.
