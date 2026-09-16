# Day 2 — Compute (ALB & Auto Scaling)

## Objective
Deploy the Application Load Balancer (ALB) and an Auto Scaling Group (ASG) of EC2 instances into the public and private subnets created on Day 1.

## Daily AWS Rebuild Checklist
- [ ] `infra/01-vpc.yaml` deployed in Console as `duokart-02-vpc`.
- [ ] VPC Stack Status is `CREATE_COMPLETE` (NAT Gateway is Available).

## Build Tasks (Today's Work)
- [ ] Create `infra/02-compute.yaml`.
- [ ] Add Application Load Balancer (ALB) pointing to public subnets.
- [ ] Add Auto Scaling Group (ASG) / EC2 Launch Template in private subnets.
- [ ] Deploy `02-compute.yaml` to AWS.

## Notes & Troubleshooting
*(Log any issues you faced and how you solved them today so you can talk about it in interviews)*

## End of Day Teardown
- [ ] Deleted Compute stack.
- [ ] Deleted VPC stack.
- [ ] Verified EC2 dashboard shows 0 running instances to stop billing.
