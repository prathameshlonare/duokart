# Deployment — console-only, us-east-2

No CLI. All stacks created via Console: CloudFormation → Create stack → Upload template file from `infra/`.

## Order (numbered)
1. `01-vpc.yaml` — VPC, 2 AZ subnets, IGW, 1 NAT, security groups (incl. bastion-sg). Live: running as stack `duokart-02-vpc` (retry 2026-09-15); Day-2 `Fn::ImportValue`s must use `duokart-02-vpc-*`. File numbering unchanged.
2. `02-compute.yaml` — ALB + ASG + EC2 (IAM role, no keys). Live: running as stack `duokart-02-compute`.
3. `03-data.yaml` — RDS MySQL Multi-AZ `db.t3.micro` (password from SSM; per 2026-09-15 diagram decision) + S3 buckets (photos versioned, bills versioned + Object Lock + lifecycle).
4. `04-queue.yaml` — SQS + Lambda + DynamoDB + SNS topics.
5. `05-observe.yaml` — CloudWatch alarms + dashboard, CloudTrail, Budgets (or Budgets via Billing console).

## Rules
- Templates are source of truth. No manual console edits to infra.
- Deploy for demo, destroy after (see `destroy-checklist.md`).
- Nightly (consecutive days): keep the VPC stack (live name, currently `duokart-02-vpc`) up all week; delete stacks built from `02`–`05` templates each evening, re-upload next morning (~15 min rebuild). Demo-eve exempt. Never resolve numbers by parsing a stack name — the Console stack list is source of truth.
- Verify each stack: Status `CREATE_COMPLETE` + screenshot committed to `main`.
