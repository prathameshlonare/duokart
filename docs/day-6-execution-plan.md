# Day 6 — Execution Plan in Simple Words (Observe Tier)

**Team:** Swapnil + Prathamesh (50/50 split, alternating commits to `main`)
**Region:** us-east-2 Ohio, Console only, no keys on laptops
**Stacks:** `duokart-01-vpc` (kept up) + `duokart-04-storage` (kept up, `ps-19`, no lock) + `duokart-02-compute` (rebuild morning) + `duokart-03-data` (rebuild morning) + `duokart-05-queue` (rebuild morning) + `duokart-06-observe` (new today)
**Goal:** Shop gets a control room. One mail thread shouts when anything burns (dead counter, poison order, dying DB, crashed packer), one screen shows all five tiers live, every console click is recorded, budget warns before the card does.
**Time:** About 45-60 mins + 25 mins morning rebuild (02 + 03 + 05 — all three are currently deleted). Observe deploys in ~5 mins + ~15 mins alarm settle.

---

## 1. The story in one minute

Think of DuoKart as a shop:

* Day 1 built the building (VPC).
* Day 2 opened counters (EC2) behind main door (ALB).
* Day 3 added back locker room (RDS) with combo in locker (SSM).
* Day 4 added two godowns outside (S3) with upload tickets.
* Day 5 added token counter + kitchen + bells (SQS → Lambda → DynamoDB → SNS).
* Day 6 adds CCTV + fire alarms + watchman's single screen: alarms on one mail thread, dashboard with all tiers, trail recording who touched what, budget guard on the wallet.

Problem today: without alarms, you learn about poison orders and dead counters from angry silence. Day 5 proved the DLQ path works — now it shouts. Without a trail, nobody can prove who broke what. Without a budget, the card speaks first.

---

## 2. Why alarms + why dashboard + why trail + why budget

If you only watch consoles by hand:

* Poison orders sit in the DLQ unseen — Day 5 built the dustbin, nobody watches it.
* A dead EC2 looks like "site slow" until ASG finishes healing — minutes of guessing.
* RDS at 90% CPU looks fine until checkout hangs at festival rush.
* A worker crash loop looks like "mails delayed" — the owner-mail mystery of Day 5 took a full debug session that one DLQ alarm would have cut to seconds.
* Console clicks leave no receipt — interviewer asks "who built what", you have only memory.

Observe fixes this:

* 8 alarms, one SNS thread: 5xx spike, dead counter, DB CPU, DB disk, queue age, DLQ depth, worker errors, table throttles. DLQ depth > 0 is the money alarm — any poison pages us.
* Dashboard `duokart-dev`: all five tiers on one screen, live within a minute of a real order.
* Trail: every Create/Update/Delete + who clicked it — the audit receipt for the alternating-commit story.
* Budget $20: mail at 60% actual + 100% forecast — wallet guard, free at this scale.

No keys on laptops. Alarms + dashboard + trail + budget are all CloudFormation, console-uploaded like every other day.

---

## 3. What order and why

Correct order is: Rebuild everything first, then Observe. Do not build alarms on an empty shop — alarms on dead metrics sit `INSUFFICIENT_DATA` forever and you learn nothing.

Why:

1. Observe template imports nothing by ARN except ALB + TargetGroup (dimension math), but every alarm needs a *live* target: ALB serving, RDS `Available`, queue draining, worker invoking. Dead targets = silent alarms.
2. The poison drill (the actual proof) needs a working `202 → PACKING` path — only possible after 05 is rebuilt and compute is updated for queue.
3. Delete order is load-bearing and reversed from intuition: `06` imports from all, `02` imports from `05`. So teardown is `06 → 02 → 05 → 03`. Day 5 night already proved deleting `05` before `02` fails on `Export … in use`.

So:

* Morning: confirm `duokart-01-vpc` AND `duokart-04-storage` are `CREATE_COMPLETE` (both kept — storage is `ps-19` no-lock, SSM s3 params resolve).
* Re-upload `02-compute` as `duokart-02-compute`, wait, check ALB live.
* Re-upload `03-data` as `duokart-03-data` with fresh DB password (systemd-safe set: `A-Z a-z 0-9 - _ ! #`, never `% $ " ' \ / @ space`), wait RDS `Available`, refresh ASG, check `/health connected` + `/products Neem Soap`.
* Re-upload `05-queue` as `duokart-05-queue`, update compute with `QueueStackName`, refresh, smoke `202 → PACKING` + both mails (check Spam for `No Subject` SNS mails — Day 5 lesson).
* Midday: build `06-observe`, subscribe alarm mail, run fire drills.

Swapnil can write `06-observe.yaml` locally while you rebuild — parallel paper work, sequential deploys.

---

## 4. Turn 1 — Swapnil: Build control room + CCTV + wallet guard (about 50%)

**You do:** SNS alarm topic + 8 alarms + dashboard + trail bucket + trail + budget + SSM param + outputs.

Steps in console:

1. Pull latest `main`. Make sure `01-vpc`, `02-compute`, `03-data`, `04-storage`, `05-queue` files are as last night (`04-storage` intact `ps-19`, no lock).
2. Create new file `infra/06-observe.yaml` with (full spec in `docs/day-6-observe.md` section 1):
   * Inputs: `EnvironmentName` dev, `VpcStackName`, `ComputeStackName`, `DataStackName`, `QueueStackName` (all defaults = live stack names), deterministic defaults `DbInstanceId=duokart-dev-db`, `OrdersQueueName`, `OrdersDlqName`, `WorkerFunctionName`, `OrdersTableName`, plus `AlarmTopicName` (default `duokart-dev-alarms`), `TrailBucketName` (default `duokart-dev-trail-ps-20`), `BudgetLimitDollars` (default `20`). No emails in template — subscribe manually after Create.
   * SNS: 1 alarm topic, no subscriptions in template.
   * 8 alarms (all fire to alarm topic, OK clears to same topic): ALB 5xx > 10/5min, unhealthy hosts > 0, RDS CPU > 80% ×3, RDS free disk < 5 GB, queue age > 300 s, DLQ depth > 0 (the money alarm), worker errors > 0, table throttles > 0.
   * Dashboard `duokart-dev`: 6 widgets (ALB, RDS, SQS+DLQ, Lambda, DynamoDB, runbook text).
   * Trail: new bucket (versioned, encrypted, expire 90 d, `Delete` policy, **no lock** — Day 4 lock pain, never again) + bucket policy for CloudTrail + trail (`us-east-2` only, log validation on, data events OFF).
   * Budget: monthly $20 COST, mail at 60% actual + 100% forecast to the shared alarm mail.
   * 1 SSM String param: `/duokart/dev/sns-alarms` = alarm topic ARN.
   * Outputs: `AlarmTopicArn`, `DashboardName` (+ console URL), `TrailArn`, `TrailBucketName`, `BudgetName` + SSM name.
3. Check file locally: `python -c` with CFN `!` ignore must print `YAML OK`.
4. Commit and push directly to `main`. Example: `feat(day6): add alarms dashboard trail budget`.
5. Console: CloudFormation → Create stack → Upload `infra/06-observe.yaml` → name `duokart-06-observe` → Ohio → defaults (bump trail suffix only on `BucketAlreadyExists`) → tick IAM capabilities → Create.
6. Wait ~5 mins + ~15 mins settle. Alarms show `INSUFFICIENT_DATA` first — normal, they flip to `OK` after 1–2 metric periods. Trail's first log file lands in ~5–15 mins — empty bucket at minute 2 is normal.
7. After Create: SNS → alarm topic → Create subscription → Email → shared alarm mail → click inbox Confirm link (alarm mails carry Subjects, so they hit Inbox — still glance at Spam once before debugging).
8. Verify: stack `CREATE_COMPLETE`, 8 alarms exist, topic subscription `Confirmed`, dashboard renders, trail Logging ON, budget exists.
9. Tell Prathamesh to pull.

Done when: stack complete + 8 alarms visible + subscription Confirmed + dashboard renders + trail ON. Take screenshots 1-2.

---

## 5. Turn 2 — Prathamesh: Fire drills + proof (about 50%)

**You do:** force a real ALARM, watch the dashboard live, prove the trail, capture evidence.

Steps:

1. Pull Swapnil's observe file.
2. Wait till all 8 alarms show `OK` (15 min after deploy with live traffic — place a good order to warm metrics).
3. Poison drill (the core proof, PowerShell):
   * POST 3× garbage order (bad total, e.g. `total: 1` vs `qty 3 × 99`) → worker throws 3× → DLQ depth 1 → `duokart-dev-dlq-depth` → `ALARM` → alarm mail with Subject arrives.
   * Resolve: SQS → DLQ → Start DLQ redrive (or purge) → alarm back to `OK` → second mail.
   * Throughout: new good order still `202` (counter never jams — Day 5 story, now with a bell).
4. Dashboard watch: place one good `202 → PACKING` order while watching `duokart-dev` — SQS age spike, Lambda invocation, DDB write visible within 1–2 min.
5. Trail proof: CloudTrail → Event history → filter today → morning `CreateStack`/`DeleteStack` calls with both user names. Plus S3 trail bucket shows dated log objects.
6. Budget proof: Billing → Budgets → `duokart-dev-monthly` $20 with 60/100 thresholds (no need to spend $20 to test it).
7. Day 5 regression: `POST /orders` 202 + `GET PACKING` + both mails + `/health connected` + `/products Neem Soap` still green.
8. Take screenshots 3-6 and push screenshots folder.

Done when: DLQ ALARM mail in hand + OK-clear mail + dashboard live data + trail lookup works + budget visible + Day 5 still green.

---

## 6. If something breaks

* Alarms stuck `INSUFFICIENT_DATA`: wait 15 min with live traffic (place a good order). Only debug after 30 min — then the dimension is wrong (check ALB short-name Split math vs console metric view).
* DLQ drill silent: worker swallowed the error instead of throwing (Day 5 contract: must throw → 3 receives → DLQ). Check DLQ depth manually first — if depth is 1 but alarm silent, `QueueName` dimension mismatches. Fix template, Update stack.
* No alarm mail: subscription `PendingConfirmation` — click inbox link (Day 5 rerun). Alarm mails have Subjects, so Inbox expected.
* Stack ROLLBACK: trail bucket name taken globally (bump `-ps-21`) or ALB dimension math off (move that one alarm to console, note it, don't sink the day).
* Delete blocked `Export … in use`: wrong teardown order. Nightly is `06 → 02 → 05 → 03`, keep `01 + 04`. Never `05` before `02`.
* Trail bucket empty at minute 2: normal, first delivery in ~5–15 min.

---

## 7. Proof photos to save in `docs/screenshots/day-6/`

1. `stack-complete.png` — `duokart-06-observe` = `CREATE_COMPLETE`
2. `alarms-list.png` — 8 alarms with states (`OK`, DLQ caught `ALARM` mid-drill if timed)
3. `alarm-mail.png` — inbox mail with ALARM Subject for `duokart-dev-dlq-depth` (+ OK-clear mail if captured)
4. `dashboard.png` — `duokart-dev` with live data on all tiers
5. `trail-logs.png` — trail Logging ON + S3 bucket objects (or Event history lookup)
6. `budget.png` — `duokart-dev-monthly` $20 with 60% actual + 100% forecast

Push directly to `main`.

---

## 8. Cost and cleanup reminder

Observe tier adds ~$0.04/day while up (8 alarms ~$0.80/mo + dashboard ~$3/mo, both zeroed by nightly delete; trail + SNS + budget ~zero). Day 6 total ~$3.05/day while up, ~$3.01/day after teardown.

Nightly (order is load-bearing): delete `06-observe` first → delete `02-compute` (releases `05` exports) → delete `05-queue` → delete `03-data` (5-10 mins RDS) → keep `01-vpc` + `04-storage` (no S3 emptying). Verify Alarms 0, Dashboard 0, Trail 0, Lambda 0, SQS 0, DynamoDB 0, RDS 0, EC2 0, S3 3 buckets (photos + bills + trail).

---

## 9. Definition of done for Day 6

* `infra/06-observe.yaml` valid and on `main`
* `duokart-06-observe` is `CREATE_COMPLETE` in Ohio
* 8 alarms exist and settle to `OK`
* Poison drill fires DLQ ALARM → mail arrives → redrive → `OK` + mail
* Dashboard `duokart-dev` shows live data on all tiers
* CloudTrail logging with S3 objects + Event history lookup works
* Budget $20 with 60% actual + 100% forecast exists
* Day 5 endpoints still green (`202 → PACKING`, both mails, `/health connected`, `/products Neem Soap`)
* 6 screenshots committed
* Both names in commit history

(End of file - total 166 lines)
