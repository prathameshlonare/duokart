# AWS scope — locked Day 0, changes need both approve

## Mandatory (build via CloudFormation in us-east-2, show in demo)
- Custom VPC (2 AZ, public/private subnets, IGW, 1 NAT only), security groups.
- EC2 + Auto Scaling + ALB (self-heal story) + EC2 bastion in public subnet (SSH jump server, key via Console only, SG 22 from admin IP only).
- RDS MySQL Multi-AZ `db.t3.micro` (products, orders, users) — per 2026-09-15 diagram decision; biggest burner with ALB, nightly deletes mandatory.
- S3: photos + bills, versioning + lifecycle to cheap storage + Object Lock on bills.
- SQS → Lambda → DynamoDB (`duokart-orders`, PK `orderId`) → SNS (buyer + owner mail).
- IAM roles for EC2/Lambda, SSM Parameter Store for DB password.
- CloudFormation YAML in `infra/`. CloudWatch alarms + dashboard. CloudTrail. Budgets 60/100.

## Deferred (document 2-3 lines in README, don't build)
- Route53 real domain purchase, WAF, 2nd NAT, S3 CRR, Beanstalk alt, CloudFront + ACM, SES (SNS email is enough).

## Doc-only (reference in architecture, no deploy)
- Route53 alias + health check to ALB (design kept compatible, no domain bought).
- Prod follow-ups: WAF on ALB, S3 CRR for DR, second region copy.
