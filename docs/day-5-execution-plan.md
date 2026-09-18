# Day 5 — Execution Plan in Simple Words (Queue Tier)

**Team:** Swapnil + Prathamesh (50/50 split, alternating commits to `main`)
**Region:** us-east-2 Ohio, Console only, no keys on laptops
**Stacks:** `duokart-01-vpc` (kept up) + `duokart-04-storage` (kept up, intact — NOT deleted) + `duokart-02-compute` (rebuild morning) + `duokart-03-data` (rebuild morning) + `duokart-05-queue` (new today)
**Goal:** Buyer clicks order, site replies instantly `202 RECEIVED`, queue holds the order, worker packs it (`PACKING`), both sides get mail. Site never hangs even if packing is slow.
**Time:** About 45-60 mins + 15 mins morning rebuild (02 + 03 only, storage untouched). Queue deploys in 3-5 mins. Lambda trigger takes ~1 min to Enable.

---

## 1. The story in one minute

Think of DuoKart as a shop:

* Day 1 built the building (VPC).
* Day 2 opened counters (EC2) behind main door (ALB).
* Day 3 added back locker room (RDS) with combo in locker (SSM).
* Day 4 added two godowns outside (S3) with upload tickets.
* Day 5 adds a token counter: buyer takes a token (`POST /orders` → `202`), sits down. Kitchen (Lambda) picks tokens one by one from the rail (SQS), writes status on the board (DynamoDB), rings two bells (SNS buyer + owner). Bad token falls in dustbin after 3 tries (DLQ) — counter never jams.

Problem today: without a queue, a slow packer blocks the counter — festival rush kills the site. Queue fixes it: counter replies in milliseconds, packing happens behind.

---

## 2. Why queue + why DLQ + why DynamoDB

If app packs orders itself in the request:

* Slow pack blocks the small counters (same Day 4 file-bytes lesson).
* Crash mid-pack loses the order — no retry, no proof.
* Two clicks = double charge, no idempotency.

Queue fixes this:

* App validates bill math + duplicate check, drops JSON in SQS, returns `202` immediately. Never waits.
* Lambda drains one by one, conditional write only moves `RECEIVED → PACKING` forward — duplicate SQS delivery can't move backward.
* 3 strikes → DLQ parks the poison order. Site keeps selling, you inspect dustbin later and redrive — no data loss by design.
* DynamoDB is the board both sides read: buyer status page + owner packing list. Single row per `orderId`, no joins needed.

No keys on laptops. EC2 uses IAM role to send SQS + read/write DynamoDB. Lambda uses its own role.

---

## 3. What order and why

Correct order is: Rebuild first, then Queue. Do not build queue on empty foundation.

Why:

1. Queue template needs nothing from VPC, but order test goes via `http://<ALB-DNS>/orders`, and that ALB only lives if `02-compute` is up with RDS + S3 wired.
2. Compute update for queue needs queue URL + table name. Those only exist after `05-queue` Outputs. So compute update must wait.
3. Lambda worker test needs a real order in SQS — only possible after app can POST.

So:

* Morning: confirm `duokart-01-vpc` AND `duokart-04-storage` are `CREATE_COMPLETE` (both kept — storage intact, same bucket names, no new suffix, SSM s3 params resolve).
* Re-upload `02-compute` as `duokart-02-compute`, wait, check ALB live.
* Re-upload `03-data` as `duokart-03-data` with fresh DB password (systemd-safe set: `A-Z a-z 0-9 - _ ! #`, never `% $ " ' \ / @ space` — Day 4 `%` lesson), wait RDS `Available`, refresh ASG, check `/health connected` + `/products Neem Soap` + presigned photo still works (storage untouched).
* Midday: build `05-queue`, then update compute for queue, refresh, test orders end-to-end.

Swapnil can write `05-queue.yaml` locally while you rebuild — parallel paper work, sequential deploys.

---

## 4. Turn 1 — Swapnil: Build token counter + kitchen + bells (about 50%)

**You do:** SQS + DLQ + DynamoDB table + 2 SNS topics + Lambda worker + role + SSM names + outputs.

Steps in console:

1. Pull latest `main`. Make sure `01-vpc`, `02-compute`, `03-data`, `04-storage` files are as last night (`04-storage` template + stack both intact — no recreate).
2. Create new file `infra/05-queue.yaml` with (full spec in `docs/day-5-queue.md` section 1):
   * Inputs: `EnvironmentName` dev, `OrdersQueueName` (default `duokart-dev-orders`), `OrdersDlqName` (default `duokart-dev-orders-dlq`), `OrdersTableName` (default `duokart-orders` — frozen contract, don't rename), `BuyerTopicName` (default `duokart-dev-buyer`), `OwnerTopicName` (default `duokart-dev-owner`). No emails in template — subscribe manually after Create.
   * SQS queue: Standard, VisibilityTimeout 60s, retention 4 days, RedrivePolicy maxReceiveCount 3 → DLQ.
   * DLQ: Standard, retention 14 days, no redrive of its own.
   * DynamoDB: PK `orderId` (S), PAY_PER_REQUEST, PITR on.
   * SNS: 2 topics, no subscriptions in template.
   * Lambda: Python 3.12 inline `index.handler`, 30s timeout, 128MB, env `TABLE_NAME` + both topic ARNs, SQS trigger BatchSize 1 Enabled. Code: parse → conditional `RECEIVED → PACKING` write → publish both mails → throw on bad payload (so it retries → DLQ, never swallows).
   * Role: assume `lambda.amazonaws.com`, managed `AWSLambdaBasicExecutionRole`, inline least-privilege SQS receive/delete + DynamoDB get/put/update + SNS publish on these ARNs only.
   * Five SSM String params: `/duokart/dev/sqs-queue-url`, `/duokart/dev/sqs-queue-arn`, `/duokart/dev/ddb-orders-table`, `/duokart/dev/sns-buyer`, `/duokart/dev/sns-owner` (same pattern as DB endpoint — servers fetch at boot, no hardcode).
   * Outputs: `OrdersQueueUrl`, `OrdersQueueArn`, `OrdersDlqArn`, `OrdersTableName`, `OrdersTableArn`, `BuyerTopicArn`, `OwnerTopicArn` + SSM names.
3. Check file locally: `python -c` with CFN `!` ignore must print `YAML OK`.
4. Commit and push directly to `main`. Example: `feat(day5): add SQS DLQ DynamoDB SNS Lambda worker`.
5. Console: CloudFormation → Create stack → Upload `infra/05-queue.yaml` → name `duokart-05-queue` → Ohio → defaults → tick IAM capabilities → Create.
6. Wait 3-5 mins. Table + queues ~30 sec, Lambda + trigger ~1 min (`Enabling` → `Enabled`).
7. After Create: SNS → each topic → Create subscription → Email → buyer/owner mails → click inbox Confirm links (publish works before confirm, mail just doesn't arrive till confirmed).
8. Verify: stack `CREATE_COMPLETE`, SQS redrive shows DLQ + 3, table key `orderId`, Lambda trigger `Enabled`, 5 SSM params exist.
9. Tell Prathamesh to pull.

Done when: stack complete + redrive visible + trigger Enabled + SSM names exist. Take screenshots 1-4.

---

## 5. Turn 2 — Prathamesh: Counter + board + test (about 50%)

**You do:** order endpoints + server queue rights + refresh + end-to-end test.

Steps:

1. Pull Swapnil's queue file.
2. Update shop app (`app/app.py`, `boto3` already there from Day 4 — nothing new in `requirements.txt`):
   * Env: `SQS_QUEUE_URL`, `DDB_ORDERS_TABLE` (default `duokart-orders`).
   * Add `POST /orders`: validate `OrderCreated` per `docs/api-contracts.md` (`orderId` required; `items` non-empty; `total == sum(qty*price)` else 400; `buyerEmail` + `paymentRef` required) → DynamoDB `get_item` for duplicate (`orderId` missing → send SQS + `put_item` RECEIVED → 202; same canonical payload → 202 same id; different payload → 409) → `sqs.send_message` → `202 {"orderId","status":"RECEIVED"}`. Keep `/`, `/health`, `/products`, `/uploads/url` untouched.
   * Add `GET /orders/<order_id>`: `dynamodb.get_item` → missing → 404; else `OrderStatus` JSON (`RECEIVED → PACKING → DONE|FAILED`).
3. Update compute paper `infra/02-compute.yaml` for auto-fetch:
   * Add param `QueueStackName` default `duokart-05-queue`.
   * To `Ec2InstanceRole` policies, add `OrderApiAccess`: `sqs:SendMessage` on `Fn::ImportValue ${QueueStackName}-OrdersQueueArn`, `dynamodb:GetItem,PutItem,Query` on table ARN import. No receive/delete (only Lambda drains).
   * In UserData boot: after S3 fetch lines, add `SQS_QUEUE_URL=$(aws ssm get-parameter ... /duokart/dev/sqs-queue-url ...)` + `DDB_ORDERS_TABLE=$(aws ssm get-parameter ... /duokart/dev/ddb-orders-table ...)` as `Environment=` into `duokart.service`. Keep DB + S3 lines untouched.
4. Test locally without AWS: `AWS_MODE=local`? No — validate pure functions: good order → 202 shape, total mismatch → 400, same id different payload → 409, unknown id → 404. Do not need real SQS for syntax check.
5. Commit and push directly to `main`. Example: `feat(day5): order counter + status board + queue auto-fetch`.
6. Console: CloudFormation → `duokart-02-compute` → Update → Direct update → Replace template → params `VpcStackName=duokart-01-vpc`, `DbStackName=duokart-03-data`, `StorageStackName=duokart-04-storage`, `QueueStackName=duokart-05-queue` → Update → wait `UPDATE_COMPLETE`.
7. Refresh servers: ASG → Instance refresh, wait 2x `healthy` in Target Group.
8. Live order test (PowerShell, one by one):
   * `POST http://<ALB-DNS>/orders` valid body → `202 RECEIVED` → `GET /orders/<id>` → `RECEIVED` then `PACKING` in ~5-15s → buyer + owner mails arrive → SQS queue depth back to 0, Lambda last run `Succeeded`.
   * Re-POST identical → `202` same id. Changed payload same id → `409`. Bad total → `400`. Unknown id → `404`.
   * Poison test (optional): POST garbage 3× → message in DLQ, new good orders still `202` (counter never jams).
9. Take screenshot 5 (`order-e2e.png`) and push screenshots folder.

Done when: valid 202 + idempotent 202 + 409 + 400 + 404 all per contract, status moves forward never backward, mails arrive, DLQ works, Day 4 endpoints still green.

---

## 6. If something breaks

* Trigger stuck `Enabling`: Lambda role missing `sqs:ReceiveMessage` on queue ARN. Fix role, mapping flips in ~1 min, no recreate.
* Orders stuck `RECEIVED`: read CloudWatch Logs `/aws/lambda/<worker>` first. Top cause: env `TABLE_NAME` empty (template Ref typo) or SNS ARN wrong. Update `05-queue` stack in place, no refresh needed for Lambda.
* `409` on identical re-POST: payload compare not canonical (key order, `297.0` vs `297`). Compare `json.dumps(sort_keys=True)` + int totals.
* DLQ filling with good orders: worker throws every time (usually SNS ARN env wrong) → 3 retries → DLQ. Fix worker, then SQS → DLQ → redrive to source — no loss by design.
* No mail: subscriptions `PendingConfirmation` — click inbox links. Publish succeeds regardless, so status still flips; only mail missing.
* Storage missing (only if someone deleted `04-storage`): bills bucket is Retained + locked — recreate needs new photos AND bills suffixes, never reuse the retained locked name. Normal path today: storage intact, skip this entirely.
* YAML `!GetAtt` error on local check: use CFN-ignore loader (same as Day 3/4), not plain `safe_load`.

---

## 7. Proof photos to save in `docs/screenshots/day-5/`

1. `stack-complete.png` — `duokart-05-queue` = `CREATE_COMPLETE`
2. `sqs-queue.png` — orders queue redrive policy (DLQ + maxReceiveCount 3)
3. `dynamodb-table.png` — `duokart-orders` keys (`orderId` S) + on-demand
4. `lambda-worker.png` — worker SQS trigger `Enabled` + last run `Succeeded`
5. `order-e2e.png` — POST `202` JSON + GET `PACKING` JSON + buyer mail

Push directly to `main`.

---

## 8. Cost and cleanup reminder

Queue tier adds ~zero (SQS 1M free, Lambda free tier, DynamoDB on-demand cents, SNS pennies). Day 5 total still ~$3.01/day (RDS + NAT + ALB + EC2).

Nightly: delete `05-queue` first (cleanest, 2 mins — trigger disables, all delete) → delete `03-data` (5-10 mins RDS) → delete `02-compute` → keep `01-vpc` + `04-storage` (retained by decision — no S3 emptying). Verify Lambda 0, SQS 0, DynamoDB 0, RDS 0, EC2 0, S3 2 buckets (photos + bills).

---

## 9. Definition of done for Day 5

* `infra/05-queue.yaml` valid and on `main`
* `duokart-05-queue` is `CREATE_COMPLETE` in Ohio
* SQS redrive 3× → DLQ verified
* DynamoDB `duokart-orders` PK `orderId` on-demand verified
* Lambda trigger `Enabled`, last run `Succeeded`
* App `POST /orders` 202 + idempotent 202 + 409 + 400, `GET /orders/:id` 200 + 404 per contract
* Status moves forward never backward, mails arrive, DLQ parks poison
* Day 4 endpoints still green (`/health connected`, `/products Neem Soap`, presigned photo + bill with checksum)
* 5 screenshots committed
* Both names in commit history
