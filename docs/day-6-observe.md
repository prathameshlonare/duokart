# Day 6 — Observe Tier (Alarms → Dashboard → Trail → Budgets)

## Objective

Stop staring at consoles. DuoKart gets a control room: CloudWatch alarms shout on one SNS mail thread when the shop catches fire (5xx spike, dead counter, poison orders, dying DB, crashed packer), a dashboard shows all five tiers on one screen, CloudTrail records who touched what, and a Budget mail warns before the credit card does.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**Requires Day 1 VPC (`duokart-01-vpc`) and Day 4 storage (`duokart-04-storage`, `ps-19`, no lock) to be running (both kept up), plus Day 2 compute (`duokart-02-compute`), Day 3 data (`duokart-03-data`) and Day 5 queue (`duokart-05-queue`) rebuilt this morning — as of writing all three are deleted, so Day 6 starts with a full rebuild (02 → 03 → 05), then observe.**

---

## Prerequisites

- [ ] VPC stack `duokart-01-vpc` is `CREATE_COMPLETE` (kept up)
- [ ] Storage stack `duokart-04-storage` is `CREATE_COMPLETE` (kept up — `ps-19` buckets, no Object Lock, dev-cleanup friendly)
- [ ] Compute stack `duokart-02-compute` rebuilt: ALB live, ASG 2x `healthy`, `/health connected`
- [ ] Data stack `duokart-03-data` rebuilt: RDS `Available`, `/products` returns Neem Soap
- [ ] Queue stack `duokart-05-queue` rebuilt: fresh `202 → PACKING` smoke order works, buyer + owner mails arrive (Day 5 `ord-000048` lesson: check Spam for `No Subject` SNS mails)
- [ ] Both contributors logged into AWS Console in `us-east-2`
- [ ] One shared alarm mail address agreed (never hardcoded — subscribed manually after Create, same as Day 5 buyer/owner pattern)

### Morning rebuild order (matters — Day 5 import lesson)

`02-compute` imports `${QueueStackName}-OrdersQueueArn` + `-OrdersTableArn` from `05-queue`, and `06-observe` will import from **all** of them. So build bottom-up, delete top-down:

- Build: `01-vpc` (kept) → `02-compute` → `03-data` → refresh ASG, check `/health` + `/products` → `05-queue` → update compute for queue, refresh, `202 → PACKING` smoke → `06-observe` last.
- Delete (nightly): `06-observe` → `02-compute` → `05-queue` → `03-data` → keep `01-vpc` + `04-storage`. Deleting `05` before `02` fails — CloudFormation blocks removing exports (`OrdersQueueArn`, `OrdersTableArn`) while `02-compute` still imports them. Same for `06`: it must die first.

---

## 1. Together — Write the Observe Template

Create `infra/06-observe.yaml` with the following resources (stack name `duokart-06-observe`):

### Resources to Build

| Resource | Purpose | Key Config |
|----------|---------|------------|
| SNS Alarm Topic | One mail thread for all alarms | Email subscription added manually in console |
| 8 CloudWatch Alarms | Shout on fire | Thresholds below, all route to alarm topic |
| CloudWatch Dashboard | One-screen control room | `duokart-dev`, 6–8 widgets across 5 tiers |
| Trail S3 Bucket | Where the CCTV footage lands | New bucket `duokart-dev-trail-ps-20`, lifecycle expire 90d, **no lock**, `Delete` policy |
| CloudTrail Trail | Who touched what | Management events read+write, `us-east-2` only, log validation on, data events OFF |
| Budget | Wallet guard | Monthly $20 cost budget, mail at 60% actual + 100% forecast |
| SSM Param (1) | Wiring | Alarm topic ARN |
| Outputs | Exports | Alarm topic ARN, dashboard name/URL, trail ARN, budget name |

### Key Configuration Details

**Params (no emails in template — ever):**
- `EnvironmentName` (default `dev`), `VpcStackName` (`duokart-01-vpc`), `ComputeStackName` (`duokart-02-compute`), `DataStackName` (`duokart-03-data`), `QueueStackName` (`duokart-05-queue`)
- Deterministic names reused as defaults (no new exports needed from old stacks): `DbInstanceId` default `duokart-dev-db` (matches `03-data.yaml:53`), `OrdersQueueName` default `duokart-dev-orders`, `OrdersDlqName` default `duokart-dev-orders-dlq`, `WorkerFunctionName` default `duokart-dev-order-worker`, `OrdersTableName` default `duokart-orders`
- `AlarmTopicName` default `duokart-dev-alarms`, `TrailBucketName` default `duokart-dev-trail-ps-20` (next suffix after `ps-19` — S3 names are global, bump on `BucketAlreadyExists`), `BudgetLimitDollars` default `20`

**ALB dimension math (the one tricky bit):**
- `02-compute` exports full ARNs (`AlbArn`, `TargetGroupArn`), but CloudWatch wants the short form (`app/<name>/<id>`, `targetgroup/<name>/<id>`). Derive with `!Select [1, !Split ['/', !ImportValue …]]` + `!Select [2, …]` joined back with `/`. If the dimension ever looks wrong, fall back to creating that one alarm in console — note it in the troubleshooting section, don't sink the day.

**Alarms (all `AlarmActions: [alarm topic]`, `OKActions: [alarm topic]`, `TreatMissingData: missing` except DLQ):**

| # | Name | Metric / Threshold | Why this number |
|---|------|--------------------|-----------------|
| 1 | `duokart-dev-alb-5xx` | `AWS/ApplicationELB` `HTTPCode_Target_5XX_Count` Sum > 10 in 5 min | Flask only 500s on real crashes; 10/5min = fire, not noise |
| 2 | `duokart-dev-alb-unhealthy` | `UnHealthyHostCount` Avg > 0 for 2× 1 min | Catches a dead counter before the ASG finishes replacing it |
| 3 | `duokart-dev-rds-cpu` | `AWS/RDS` `CPUUtilization` Avg > 80% for 3× 5 min on `duokart-dev-db` | `db.t3.micro` bursty — sustained 80% = query or connection leak |
| 4 | `duokart-dev-rds-storage` | `FreeStorageSpace` < 5 GB (20 GB gp2) | Early warning; autoscaling caps at 50 GB per `03-data.yaml:58` |
| 5 | `duokart-dev-sqs-age` | `AWS/SQS` `ApproximateAgeOfOldestMessage` > 300 s on orders queue | Worker dead/stuck — order sits 5 min unserved |
| 6 | `duokart-dev-dlq-depth` | `ApproximateNumberOfMessagesVisible` > 0 on DLQ, 1 datapoint / 5 min, `TreatMissingData: notBreaching` | **The money alarm.** Any poison order in the wild pages us. Day 5 proved the path works — now it shouts. |
| 7 | `duokart-dev-worker-errors` | `AWS/Lambda` `Errors` Sum > 0 on `duokart-dev-order-worker` / 5 min | Packer crashed (bad payload, SNS deny, DDB conditional fail) |
| 8 | `duokart-dev-ddb-throttle` | `AWS/DynamoDB` `ThrottledRequests` Sum > 0 on `duokart-orders` / 5 min | On-demand still throttles on hot `orderId` spikes |

**SNS alarm topic (`duokart-dev-alarms`):**
- No subscriptions in template. After Create: console → topic → Create subscription → Email → shared alarm mail → Confirm via inbox link (Day 5 lesson: publish succeeds before confirm, mail just doesn't arrive).
- Day 5 `No Subject` spam lesson does **not** apply here — CloudWatch alarm notifications always carry a Subject (`ALARM: "name" in …`), so they land in Inbox, not Spam.

**Dashboard (`duokart-dev`, `us-east-2`):** one `AWS::CloudWatch::Dashboard` with:
1. ALB: `RequestCount` + `HTTPCode_Target_5XX_Count` + `HealthyHostCount`/`UnHealthyHostCount`
2. RDS: `CPUUtilization` + `DatabaseConnections` + `FreeStorageSpace`
3. SQS orders: `ApproximateNumberOfMessagesVisible` + `ApproximateAgeOfOldestMessage`; DLQ: visible count
4. Lambda worker: `Invocations` + `Errors` + `Duration`
5. DynamoDB `duokart-orders`: `ConsumedReadCapacityUnits` + `ConsumedWriteCapacityUnits` + `ThrottledRequests`
6. Text widget: stack links + runbook one-liners (DLQ redrive path, poison checklist)

**CloudTrail (`duokart-dev-trail`):**
- Trail bucket `duokart-dev-trail-ps-20`: versioning on, encryption AES256, lifecycle expire 90 d, `DeletionPolicy: Delete` (no lock — Day 4 lock pain taught us), bucket policy allowing `cloudtrail.amazonaws.com` to `PutObject` + `GetBucketAcl` (CFN template owns the policy, same-stack so no ordering issue).
- Trail: `IsMultiRegionTrail: false` (cost), `EnableLogFileValidation: true`, management events Read+Write, S3 data events OFF (they 10x the bill).
- What it proves: every console Create/Update/Delete + who did it — the audit receipt for the alternating-commit story.

**Budget (`duokart-dev-monthly`, `AWS::Budgets::Budget`):**
- `TimeUnit: MONTHLY`, `BudgetType: COST`, limit `$20` (covers ~$3/day with teardown discipline + headroom).
- Notifications: 60% of actual → email; 100% of forecasted → email. Subscribers = same shared alarm mail (plain `Address`, `Type: EMAIL` — Budgets sends its own Subject, no confirm-click needed).
- Fallback allowed: Billing console → Budgets → same numbers (per `docs/deployment.md:11`). Note which path you used.

**SSM param (Type String):**
- `/duokart/dev/sns-alarms` = alarm topic ARN (same fetch-at-boot pattern as DB/S3/queue — future UserData or scripts read it, no hardcode).

**Outputs (+ Exports `${AWS::StackName}-*`):**
- `AlarmTopicArn`, `DashboardName` (+ console URL as plain output, not export), `TrailArn`, `TrailBucketName`, `BudgetName`, `AlarmTopicSSMName`.

### Verify Template Locally (no AWS calls)

```bash
python -c "import yaml; yaml.SafeLoader.add_multi_constructor('', lambda l,s,n: None); yaml.safe_load(open('infra/06-observe.yaml')); print('YAML OK')"
```

---

## 2. Handoff Rule

Follow the pair programming handoff from `NEW-WORKFLOW.md`:

**Turn 1 (Swapnil):**
- Write `infra/06-observe.yaml` (topic + 8 alarms + dashboard + trail bucket/trail + budget + SSM + Outputs)
- Test and push directly to `main`

**Turn 2 (Prathamesh):**
- Pull from `main`
- Deploy-day checks + fire drills (poison order → DLQ alarm mail, dashboard live data, trail lookup, budget exists)
- Test and push directly to `main`

**Result:** Both names appear in commit history with alternating commits.

---

## 3. Deploy via Console

### Steps

1. Morning rebuild first (all three are currently deleted): re-upload `02-compute` → `03-data` (fresh systemd-safe DB password: `A-Z a-z 0-9 - _ ! #`, never `% $ " ' \ / @ space`) → refresh ASG → `/health connected` + `/products Neem Soap` → re-upload `05-queue` → update compute with `QueueStackName` → refresh → `202 → PACKING` smoke + both mails.
2. Open AWS Console → CloudFormation → Create stack → Upload `infra/06-observe.yaml`
3. Region: `us-east-2` (Ohio)
4. Stack name: `duokart-06-observe`
5. Parameters: defaults fine; `TrailBucketName` bump suffix only on `BucketAlreadyExists`
6. Capabilities: tick IAM acknowledgement (trail bucket policy + CloudWatch roles) → Create → wait `CREATE_COMPLETE` (~3–5 min; trail + alarms trickle in)
7. After Create: SNS → `duokart-dev-alarms` → Create subscription → Email → shared alarm mail → Confirm via inbox link. Budgets mail needs no confirm.

### What to Watch For

- Alarms appear in `ININUFFICIENT_DATA` first — normal, they flip to `OK` after first metric period (5–15 min). Do **not** "fix" this.
- Trail → first log file lands in the bucket in ~5–15 min. Empty bucket at minute 2 is normal.
- Total deploy time: ~5 min + ~15 min settle. Start drills after all alarms show `OK` (except DLQ drill, which you will force to `ALARM`).

---

## 4. Verify the Deployment

### CloudFormation Verification

- [ ] Stack Status = `CREATE_COMPLETE` (no `ROLLBACK` events)
- [ ] Outputs tab shows alarm topic ARN, dashboard name, trail ARN, budget name

### Console Verification

- [ ] SNS → `duokart-dev-alarms` → subscription `Confirmed`
- [ ] CloudWatch → Alarms → 8 alarms exist, 7× `OK` + DLQ `OK` (pre-drill)
- [ ] CloudWatch → Dashboards → `duokart-dev` renders all widgets with data (after traffic)
- [ ] CloudTrail → Trails → `duokart-dev-trail` Logging ON; S3 bucket has dated log objects
- [ ] Billing → Budgets → `duokart-dev-monthly` $20 with 60% actual + 100% forecast alerts

### Fire Drills (Turn 2 — the actual proof)

- [ ] **Poison drill (real ALARM):** POST 3× garbage order (bad total or bad JSON shape so the worker throws) → DLQ depth 1 → `duokart-dev-dlq-depth` → `ALARM` → alarm mail arrives with Subject → resolve: console Start DLQ redrive or purge, alarm returns to `OK` → second mail. New good order still `202` throughout (counter never jams — Day 5 story, now with a bell on it).
- [ ] **Worker-error witness:** CloudWatch Logs `/aws/lambda/duokart-dev-order-worker` shows the 3 throws matching the drill; `duokart-dev-worker-errors` blips `ALARM` → `OK`.
- [ ] **Dashboard live:** place one good order during watch — SQS age spike, Lambda invocation, DDB write all visible on `duokart-dev` within 1–2 min.
- [ ] **Trail lookup:** CloudTrail → Event history → filter `CreateStack`/`DeleteStack` today → your morning rebuild is there with user names. Shakespeare-proof that both of you touched infra.
- [ ] **Budget exists:** screenshot the budget + its two thresholds (no need to blow $20 to test it).

---

## 5. Troubleshooting

### Issue: Stack ROLLBACK on Create

**Root cause:** Usually the trail bucket name collides globally (`BucketAlreadyExists`) or the ALB dimension Split/Select math is off.
**Solution:** Bump `TrailBucketName` suffix (`-ps-21`) and retry; for dimension errors, create that one ALB alarm in console, remove it from the template, note it here.

### Issue: Alarms stuck INSUFFICIENT_DATA

**Root cause:** Nothing yet — metrics need 1–2 periods.
**Solution:** Wait 15 min with live traffic (place a good order). Only investigate if still stuck after 30 min (then check dimension values vs console metric view).

### Issue: DLQ drill doesn't fire the alarm

**Root cause:** Poison never reached DLQ (worker swallowed the error instead of throwing) or alarm on wrong queue name.
**Solution:** Worker must `throw` on bad payload (Day 5 contract) → 3 receives → DLQ. Check SQS DLQ depth manually first; if depth is 1 but alarm silent, the dimension `QueueName` mismatches `OrdersDlqName` — fix template, Update stack.

### Issue: No alarm mail

**Root cause:** Subscription `PendingConfirmation` (Day 5 rerun) or mail in Spam.
**Solution:** SNS → topic → Subscriptions → `Confirmed`. Alarm mails carry Subjects so Inbox is expected — still check Spam once before debugging further.

### Issue: Delete blocked (`Export … in use`)

**Root cause:** Wrong teardown order — `02-compute` imports `05-queue` exports; `06-observe` imports from everything.
**Solution:** Nightly order is `06-observe` → `02-compute` → `05-queue` → `03-data`, keep `01-vpc` + `04-storage`. Never `05` before `02` (this exact failure already happened on Day 5 night).

---

## 6. Evidence Required

Screenshot and commit directly to `main`:

| # | What | Where to Find | Filename |
|---|------|---------------|----------|
| 1 | Stack complete | CloudFormation → duokart-06-observe → stack info | `stack-complete.png` |
| 2 | All alarms OK | CloudWatch → Alarms (8 rows, states) | `alarms-list.png` |
| 3 | DLQ alarm mail | Inbox mail with ALARM Subject for `duokart-dev-dlq-depth` | `alarm-mail.png` |
| 4 | Dashboard live | CloudWatch → Dashboards → duokart-dev with data | `dashboard.png` |
| 5 | Trail logging | CloudTrail trail ON + S3 bucket objects (or Event history lookup) | `trail-logs.png` |
| 6 | Budget thresholds | Billing → Budgets → duokart-dev-monthly 60/100 | `budget.png` |

Save to `docs/screenshots/day-6/` and push directly to `main`.

---

## 7. Cost Impact

| Resource | Cost | Notes |
|----------|------|-------|
| 8 alarms (standard resolution) | ~$0.80/mo total | $0.10/alarm-metric/month |
| Dashboard (3+ metrics, 1 dashboard) | ~$3.00/mo | Only while stack lives; nightly delete zeroes it |
| CloudTrail (1 trail, mgmt events) | ~$0.00/day | First trail free-ish; S3 storage cents |
| Trail bucket | ~$0.00/day | Lifecycle expire 90 d, Delete policy |
| SNS alarm mails | ~$0.00/day | Pennies per 1000 |
| Budget | $0 | Budgets tracking is free at this scale |
| **Total Day 6** | **~$3.05/day while up** | Back to ~$3.01/day after nightly teardown |

**Nightly policy:** Delete `duokart-06-observe` first → `02-compute` → `05-queue` → `03-data` (5–10 min RDS) → keep `01-vpc` + `04-storage`. Verify: Alarms 0, Dashboard 0, Trail 0, Lambda 0, SQS 0, DynamoDB 0, RDS 0, EC2 0, S3 3 buckets (photos + bills + trail, all with Delete policy).

---

## 8. Nightly Teardown (order is load-bearing — read before clicking)

1. CloudFormation → `duokart-06-observe` → Delete (~2–3 min)
2. CloudFormation → `duokart-02-compute` → Delete (~2–3 min, releases `05` exports)
3. CloudFormation → `duokart-05-queue` → Delete (~2 min)
4. CloudFormation → `duokart-03-data` → Delete (~5–10 mins RDS)
5. Keep `duokart-01-vpc` + `duokart-04-storage`
6. Verify: Alarms 0, Lambda 0, SQS 0, DynamoDB 0, RDS 0, EC2 0, S3 3 buckets

---

## 9. Definition of Done

- [ ] `infra/06-observe.yaml` written and YAML-validated locally
- [ ] Template pushed directly to `main`
- [ ] Stack deployed as `duokart-06-observe` in `us-east-2`
- [ ] Stack Status = `CREATE_COMPLETE`
- [ ] 8 alarms exist, settle to `OK`
- [ ] Poison drill: DLQ alarm fires → mail with Subject arrives → redrive → `OK` + mail
- [ ] Dashboard `duokart-dev` shows live data on all tiers
- [ ] CloudTrail logging with S3 objects + Event history lookup works
- [ ] Budget $20 with 60% actual + 100% forecast alerts exists
- [ ] Day 5 endpoints still green (`202 → PACKING`, both mails, `/health connected`, `/products Neem Soap`)
- [ ] 6 screenshots captured and committed
- [ ] Both names in commit history

---

## Day 7 Starting Point

Ship tier: SecureString migration (`03-data` in-place update) + kill-1-EC2 self-heal drill + bills-lock proof + README rewrite + `architecture.png` + fork + full destroy. See `docs/day-7-ship.md`.

**What you'll need from today:**
- Alarm mail thread (reuse for ship-day confidence during self-heal drill)
- Dashboard URL (screenshot backdrop for README)
- Trail lookup habit (prove who did the Day 7 SecureString update)
- Note: `docs/day-7-ship.md` still references the old `ps-18` Compliance-locked bills bucket — storage is now `ps-19` with no lock. Fix that section during ship day instead of fighting a lock that no longer exists. `docs/destroy-checklist.md` numbering (`05-observe`/`04-queue`) is also stale — correct it on Day 7.
