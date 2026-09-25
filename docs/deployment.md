# Deployment — console-only, us-east-2

No CLI. All stacks created via Console: CloudFormation → Create stack → Upload template file from `infra/`.

## Order (numbered)
1. `01-vpc.yaml` — VPC, 2 AZ subnets, IGW, 1 NAT, security groups (incl. bastion-sg). Live: running as stack `duokart-01-vpc` (standardized 2026-09-17, was `duokart-02-vpc` after 2026-09-15 retry); imports must use `duokart-01-vpc-*`. File numbering unchanged.
2. `02-compute.yaml` — ALB + ASG + EC2 (IAM role, no keys, SSM auto-fetch for DB). Live: running as stack `duokart-02-compute`.
3. `03-data.yaml` — RDS MySQL Multi-AZ `db.t3.micro` (password from SSM) + DB Subnet Group. Live: deployed as `duokart-03-data` (Day 3 complete, verified `/health connected` + `/products Neem Soap`).
4. `04-storage.yaml` — S3 photos + bills (versioning + lifecycle, Object Lock on bills). Live: deployed as `duokart-04-storage` (Day 4 complete, verified presigned photo + bill PUT with checksum).
5. `05-queue.yaml` — SQS + DLQ + DynamoDB (`duokart-orders`) + SNS buyer/owner + Lambda worker. Ready to build (Day 5, see `docs/days/day-5-queue.md`).
6. `06-observe.yaml` — CloudWatch alarms + dashboard, CloudTrail, Budgets (or Budgets via Billing console).
7. Day 7 ship — no new stack: SecureString migration (in-place `03-data` update) + evidence drills + README/architecture polish + fork + full destroy. See `docs/days/day-7-ship.md`.

## Rules
- Templates are source of truth. No manual console edits to infra.
- Deploy for demo, destroy after (see `destroy-checklist.md`).
- Nightly (consecutive days): keep the VPC stack (live name, currently `duokart-01-vpc`) + storage stack (`duokart-04-storage`, retained — Day 4 Compliance lock makes delete pointless) up all week; delete stacks built from `02`, `03`, `05` templates each evening, re-upload next morning (~15 min rebuild: 02 + 03 only). Demo-eve exempt. Never resolve numbers by parsing a stack name — the Console stack list is source of truth.
- Verify each stack: Status `CREATE_COMPLETE` + screenshot committed to `main`.
