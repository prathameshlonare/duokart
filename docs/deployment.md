# Deployment — console-only, us-east-2

No CLI. All stacks created via Console: CloudFormation → Create stack → Upload template file from `infra/`.

## Order (numbered)
1. `01-vpc.yaml` — VPC, 2 AZ subnets, IGW, 1 NAT, security groups.
2. `02-alb.yaml` — ALB + ASG + EC2 (IAM role, no keys).
3. `03-data.yaml` — RDS MySQL single-AZ `db.t3.micro` (password from SSM) + S3 buckets (photos versioned, bills versioned + Object Lock + lifecycle).
4. `04-queue.yaml` — SQS + Lambda + DynamoDB + SNS topics.
5. `05-observe.yaml` — CloudWatch alarms + dashboard, CloudTrail, Budgets (or Budgets via Billing console).

## Rules
- Templates are source of truth. No manual console edits to infra.
- Deploy for demo, destroy after (see `destroy-checklist.md`).
- Verify each stack: Status `CREATE_COMPLETE` + screenshot into PR.
