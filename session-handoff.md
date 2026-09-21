# DuoKart Project — Session Handoff

## Project Overview
Multi-day AWS cloud project building a shop application stack:
- **Region:** us-east-2 (Ohio)
- **Team:** Swapnil + Prathamesh (50/50 alternating commits to `main`)
- **Console only** — no AWS CLI, no keys on laptops

---

## Current Status

| Day | Stack | Status | Notes |
|-----|-------|--------|-------|
| Day 1 | `duokart-01-vpc` | UP | VPC kept up all week |
| Day 2 | `duokart-02-compute` | DELETED | Rebuilt each morning |
| Day 3 | `duokart-03-data` | DELETED | Rebuilt each morning |
| Day 4 | `duokart-04-storage` | UP | Retained — bills bucket locked (Compliance 30d) |
| Day 5 | `duokart-05-queue` | UP | Turn 1 complete, Turn 2 in progress |

---

## Day 5 Status

**Turn 1 (Swapnil) — COMPLETE:**
- `infra/05-queue.yaml` deployed as `duokart-05-queue`
- Resources: SQS + DLQ + DynamoDB + 2 SNS topics + Lambda worker
- 9 SSM params all verified in `/duokart/dev/*`
- Stack `CREATE_COMPLETE`

**Turn 2 (Prathamesh) — IN PROGRESS:**
- Pulled code, started working
- Needs to:
  1. Add `POST /orders` to `202 RECEIVED` + `GET /orders/<id>` to `app.py`
  2. Update `02-compute.yaml` with `QueueStackName` param + SQS/DynamoDB SSM fetch in UserData
  3. Deploy compute update + ASG refresh
  4. Test: 202 valid, 202 idempotent, 409 different payload, 400 bad total, 404 unknown
  5. Take screenshot `order-e2e.png`

---

## Files in `infra/`

| File | Purpose |
|------|---------|
| `01-vpc.yaml` | VPC + subnets + SGs (Day 1) |
| `02-compute.yaml` | ALB + ASG + Launch Template (Day 2, updated Day 3 for SSM fetch, Day 4 for S3, Day 5 pending queue fetch) |
| `03-data.yaml` | RDS MySQL 8.0 Multi-AZ + SSM password (Day 3) |
| `04-storage.yaml` | S3 photos + locked bills buckets (Day 4) |
| `05-queue.yaml` | SQS + DLQ + DynamoDB + SNS + Lambda worker (Day 5) |
| `schema.sql` | Products, users, orders tables |

---

## SSM Parameters (all in `/duokart/dev/`)

| Param | Stack | Value |
|-------|-------|-------|
| `db-endpoint` | 03-data | RDS hostname |
| `db-password` | 03-data | RDS password |
| `s3-photos` | 04-storage | Photos bucket name |
| `s3-bills` | 04-storage | Bills bucket name |
| `sqs-queue-url` | 05-queue | SQS queue URL |
| `sqs-queue-arn` | 05-queue | SQS queue ARN |
| `ddb-orders-table` | 05-queue | DynamoDB table name |
| `sns-buyer` | 05-queue | SNS buyer topic ARN |
| `sns-owner` | 05-queue | SNS owner topic ARN |

---

## Key Issues Fixed

| Issue | Fix |
|-------|-----|
| `03-data.yaml` EngineVersion `"8.0"` deprecated | Changed to `"8.0.46"` |
| Tags format differs by resource type | RDS = array `[{Key, Value}]`, SSM = dict `{Key: Value}` |
| `05-queue.yaml` Lambda policy ARN missing `service-role/` | Changed to `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole` |

---

## Morning Rebuild Procedure (each day)

1. Re-upload `02-compute` as `duokart-02-compute`
2. Re-upload `03-data` as `duokart-03-data` (new DB password — systemd-safe: `A-Z a-z 0-9 - _ ! #`, avoid `% $ " ' \ / @ space`)
3. Wait for RDS `Available`
4. ASG - Instance Refresh - wait 2 healthy
5. Verify `/health connected`, `/products Neem Soap`
6. `04-storage` + `05-queue` stay up, NOT rebuilt

---

## Nightly Teardown Order

1. Delete `05-queue` (2 mins, cleanest)
2. Delete `03-data` (5-10 mins RDS)
3. Delete `02-compute` (2-3 mins)
4. Keep `01-vpc` + `04-storage` (storage retained — bills locked)

---

## What to Say in New Session

> "I am working on the DuoKart AWS project. Day 5 Turn 1 is complete (05-queue.yaml deployed). Prathamesh is working on Turn 2 (order endpoints + compute update). Help me [your next task]."
>
> Then paste this handoff as context.

---

## Remaining After Day 5

- **Day 6:** Observe tier — CloudWatch alarms (ALB 5xx, RDS CPU, SQS age, DLQ depth, Lambda errors) + dashboard + CloudTrail + Budgets

---

## Screenshot Locations

| Day | Folder | Count |
|-----|--------|-------|
| Day 0 | `docs/screenshots/day-0/` | Done |
| Day 1 | `docs/screenshots/day-1/` | Done |
| Day 2 | `docs/screenshots/day-2/` | Done |
| Day 3 | `docs/screenshots/day-3/` | 7 files |
| Day 4 | `docs/screenshots/day-4/` | 8 files |
| Day 5 | `docs/screenshots/day-5/` | 4 files (waiting for Turn 2 screenshot 5) |

---

## Cost Tracking

| Resource | Daily Cost |
|----------|------------|
| NAT Gateway | ~$1.00 |
| RDS db.t3.micro Multi-AZ | ~$0.84 |
| ALB | ~$0.54 |
| EC2 2x t3.micro | ~$0.67 |
| S3 + SQS + Lambda + DynamoDB + SNS | ~$0.00 |
| **Total** | **~$3.01/day** |

---

## Git Commit History (recent)

```
30cc2a2 docs: day 5 queue plan linked, status to day 5
78fd935 docs(day4): add storage proof screenshots
7e82956 fix(day4): require checksum for bills Object Lock PUT
fac91e1 fix(day4): force regional S3 endpoint for presigned URLs
89acecb feat(day4): presigned uploads + S3 auto-fetch
2fae62f feat(day4): add S3 photos + locked bills buckets
e6d6e1d docs(day3-4): close Day 3 checks, fix live stack names, add Day 4 storage docs
01e5522 docs(day3): add 5 proof screenshots
d173e7d feat(day3): compute auto-fetch DB creds from SSM
5f808fb feat(day3): Flask RDS wiring + products schema
```
