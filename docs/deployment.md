# Deployment — console-only, us-east-2

No CLI. All stacks created via Console: CloudFormation → Create stack → Upload template file from `infra/`.

## Order (numbered)
1. `01-vpc.yaml` — VPC, 2 AZ subnets, IGW, 1 NAT, security groups (incl. bastion-sg). Live: running as stack `duokart-01-vpc` (standardized 2026-09-17, was `duokart-02-vpc` after 2026-09-15 retry); imports must use `duokart-01-vpc-*`. File numbering unchanged.
2. `02-compute.yaml` — ALB + ASG + EC2 (IAM role, no keys, SSM auto-fetch for DB). Live: running as stack `duokart-02-compute`.
3. `03-data.yaml` — RDS MySQL Multi-AZ `db.t3.micro` (password from SSM) + DB Subnet Group. Live: deployed as `duokart-03-data` (Day 3 complete, verified `/health connected` + `/products Neem Soap`).
4. `04-storage.yaml` — S3 photos + bills (versioning + lifecycle, Object Lock on bills). Ready to build (Day 4).
5. `05-observe.yaml` — CloudWatch alarms + dashboard, CloudTrail, Budgets (or Budgets via Billing console).

## Rules
- Templates are source of truth. No manual console edits to infra.
- Deploy for demo, destroy after (see `destroy-checklist.md`).
- Nightly (consecutive days): keep the VPC stack (live name, currently `duokart-01-vpc`) up all week; delete stacks built from `02`–`05` templates each evening, re-upload next morning (~15 min rebuild). Demo-eve exempt. Never resolve numbers by parsing a stack name — the Console stack list is source of truth.
- Verify each stack: Status `CREATE_COMPLETE` + screenshot committed to `main`.
