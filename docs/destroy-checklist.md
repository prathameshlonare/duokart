# Destroy checklist — run after demo (credits expiring)

Console-only, us-east-2. Delete in reverse deploy order. Screenshot each.

- [ ] `05-observe.yaml` stack deleted (alarms, dashboard; CloudTrail off).
- [ ] `04-queue.yaml` stack deleted — Lambda, SQS, SNS topics, and DynamoDB table all deleted.
- [ ] `03-data.yaml` stack deleted — RDS gone (final snapshot only if needed for screenshots, else skip: snapshots cost); S3 buckets emptied (all versions) then deleted.
- [ ] `02-alb.yaml` stack deleted — confirm ALB gone (biggest burner).
- [ ] `01-vpc.yaml` stack deleted — confirm NAT Gateway gone (second burner).
- [ ] Budgets kept until account close. CloudTrail logs in S3 deleted.
- [ ] Final Billing console screenshot → `docs/cost-log.md`.
- [ ] Who pressed destroy: _fill_ + date.

Idle rule: if not demoing within 24h, delete 02 + 03 at minimum.
