# Architecture — DuoKart (us-east-2, console-only)

## Diagram (fill by demo day)
ASCII or image link here. Boxes: browser → ALB → ASG/EC2 → RDS; app → SQS → Lambda → DynamoDB → SNS (buyer+owner); app → S3 presigned (photos/bills). Underlay: custom VPC (2 AZ, 1 NAT), CloudWatch alarms, CloudTrail.

## How it connects
- Web path and order path are independent: site stays up (ALB+ASG) even when order queue backs up (SQS buffers).
- Contracts: `docs/api-contracts.md`. Deploy order: `docs/deployment.md`. Scope: `docs/aws-scope.md`.
- Route53: alias-to-ALB design doc-only (no domain purchased).

## Evidence (fill at end)
- [ ] Diagram image committed here or linked.
- [ ] Kill-1-EC2 self-heal screenshots.
