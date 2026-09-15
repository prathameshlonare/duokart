# Day 1 — network (VPC) in us-east-2, console-only

## Objective
Custom VPC via template, zero running servers. Follow only this doc. Region `us-east-2` (Ohio), Console-only.

## Prerequisites
- Day 0 done: repo exists, both IAM logins pass, budgets visible.
- Owner assigned in `docs/contribution-log.md` (one builds `s/day1-vpc` or `p/day1-vpc`, other reviews).

## Build tasks

| # | What | How (exact) | What to document | When to push |
|---|------|-------------|------------------|--------------|
| 1 | Write `infra/01-vpc.yaml` | CloudFormation YAML: VPC `10.0.0.0/16` tagged `Project=DuoKart, Environment=dev, ManagedBy=CloudFormation`. 2 public subnets (`10.0.1.0/24` in us-east-2a, `10.0.2.0/24` in us-east-2b) + 2 private (`10.0.11.0/24` 2a, `10.0.12.0/24` 2b). IGW + 1 NAT in first public subnet. Public/private route tables. SGs: `alb-sg` (80/443 in from `0.0.0.0/0`), `app-sg` (in from `alb-sg` only), `db-sg` (3306 in from `app-sg` only), `bastion-sg` (22 in from admin IP only). Outputs: VpcId, subnet IDs, SG IDs + NAT (10 total). | Template comments on NAT single-AZ cost tradeoff | Commit on branch, PR at end |
| 2 | Deploy via Console | CloudFormation → Create stack → "Upload a template file" → choose `infra/01-vpc.yaml` → region us-east-2 → stack name `duokart-02-vpc` (retry shell — first attempt `duokart-01-vpc` rolled back on SG description charset; exports are `duokart-02-vpc-*`) → Create. Wait for Status `CREATE_COMPLETE` (refresh Events tab). | Screenshot of stack Outputs tab (live: `duokart-02-vpc`) | Paste into PR description |
| 3 | Verify | VPC console: 1 VPC, 4 subnets, 1 NAT Gateway `Available`. EC2/RDS consoles empty. | Empty-console screenshots | Same PR |

## Verification (expected outputs)
- Stack Status = `CREATE_COMPLETE`, no `ROLLBACK` events.
- Outputs show 1 VpcId + 4 subnet IDs + 4 SG IDs (10 Outputs incl bastion + NAT).
- NAT Gateway state `Available` (note: hourly burn starts here).

## Evidence required
- Stack Outputs screenshot + empty EC2/RDS screenshots in PR.
- Reviewer approves; merge to `main`.

## Cost impact
- NAT Gateway hourly (~largest Day-1 burner, ~$1/day). Consecutive build days: keep this stack up all week. Full nightly policy in `AGENTS.md` §2.

## Definition of done
- [ ] `infra/01-vpc.yaml` merged, tagged, with outputs.
- [ ] Stack `CREATE_COMPLETE` in us-east-2, screenshots filed.
- [ ] Zero EC2/RDS. Tick off here + `contribution-log.md`.
- [ ] Next: Day 2 (ALB+ASG) — separate doc, not started yet.
