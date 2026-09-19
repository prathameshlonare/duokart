# Day 5 — Queue Tier (SQS → Lambda → DynamoDB → SNS)

## Objective

Decouple order-taking from order-processing so the site stays up in festival rush. App accepts orders instantly (`202 RECEIVED`), queues them in SQS; Lambda worker drains the queue, writes status to DynamoDB (`duokart-orders`, PK `orderId`), and notifies buyer + owner via SNS mail.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**Requires Day 1 VPC (`duokart-01-vpc`) and Day 4 storage (`duokart-04-storage`) to be running (both kept up — storage retained due to Day 4 Compliance lock), plus Day 2 compute (`duokart-02-compute`) and Day 3 data (`duokart-03-data`) rebuilt each morning.**

---

## Prerequisites

- [x] VPC stack `duokart-01-vpc` is `CREATE_COMPLETE` (kept up)
- [x] Storage stack `duokart-04-storage` is `CREATE_COMPLETE` (kept up — NOT deleted, see gotcha below)
- [x] Compute stack `duokart-02-compute` is `CREATE_COMPLETE` (fresh morning rebuild, with Day 4 S3 auto-fetch UserData)
- [x] Data stack `duokart-03-data` is `CREATE_COMPLETE`, RDS `Available`, `/products` returns Neem Soap (fresh morning rebuild)
- [x] Both contributors logged into AWS Console in `us-east-2`
- [x] Morning rebuild done (~15 mins): re-upload `02-compute`, then `03-data` with fresh DB password (systemd-safe set, no `% $ " ' \`), refresh ASG, check `/health connected` — `04-storage` untouched, verify its SSM `/duokart/dev/s3-photos` + `/duokart/dev/s3-bills` params still resolve

### Morning gotcha — storage KEPT, not rebuilt (retention decision)

`duokart-04-storage` was **kept up overnight** — the Day 4 bills bucket has `DeletionPolicy: Retain` + Compliance 30d, so deleting storage gains almost nothing (bills retains anyway) and forces new-bucket churn. Only `02-compute` + `03-data` were deleted; `01-vpc` + `04-storage` are intact.

What this means for Day 5:
- Same bucket names (`duokart-dev-photos-ps-18`, `duokart-dev-bills-ps-18`) — no new suffix, no `BucketAlreadyExists` risk.
- SSM `/duokart/dev/s3-photos` + `/duokart/dev/s3-bills` still exist with same values — UserData S3 fetch works unchanged.
- Photos bucket still holds Day 4 `test.txt`/`test2.txt` (fine — proof objects, ~cents). Bills `test.txt` still locked (fine).
- Compute update keeps `StorageStackName=duokart-04-storage` (real name) — no change.
- If S3 console ever shows `04-storage` missing (manual delete), fall back to full recreate with new photos suffix + new bills suffix — never reuse a retained locked bills name.

---

## 1. Together — Write the Queue Template

Create `infra/05-queue.yaml` with the following resources (stack name `duokart-05-queue` — note `docs/destroy-checklist.md` says `04-queue`, that numbering is stale; actual file is `05-queue` since storage took `04`):

### Resources to Build

| Resource | Purpose | Key Config |
|----------|---------|------------|
| SQS Queue | Order buffer | Standard queue, VisibilityTimeout 60s, 4-day retention |
| SQS DLQ | Poison-pill box | Standard queue, 14-day retention, redrive after 3 receives |
| DynamoDB Table | Order status store | PK `orderId` (S), PAY_PER_REQUEST, per contract `duokart-orders` |
| SNS Buyer Topic | Buyer mail | Email subscription added manually in console |
| SNS Owner Topic | Owner alert mail | Email subscription added manually in console |
| Lambda Worker | Queue drainer | Python 3.12 inline, SQS trigger batch 1, 30s timeout |
| Lambda IAM Role | Worker rights | SQS + DynamoDB + SNS least privilege + CloudWatch Logs |
| SSM Params (5) | Wiring | Queue URL/ARN, table name, 2 topic ARNs |
| Outputs | Exports | QueueUrl/Arn, DLQ arn, TableName/Arn, TopicArns, SSM names |

### Key Configuration Details

**SQS queue (`duokart-dev-orders-<suffix>` — pass as param `OrdersQueueName`, SQS names are per-account so suffix is convention, not global-unique like S3):**
- Queue type: Standard (not FIFO — contract needs throughput, duplicates handled by `orderId` idempotency, not ordering)
- VisibilityTimeout: 60s (Lambda timeout 30s × 2, so a crashed worker reappears once)
- MessageRetentionPeriod: 345600 (4 days)
- RedrivePolicy: `maxReceiveCount: 3` → DLQ (poison order retried 3× then parked, site never blocks)
- Tags: Project DuoKart, Environment dev

**SQS DLQ (`duokart-dev-orders-dlq-<suffix>`):**
- Same type, retention 1209600 (14 days, time to inspect bad orders)
- No redrive on the DLQ itself (terminal box)
- Alarm later (Day 6 observe): DLQ depth > 0 = bad payload in the wild

**DynamoDB table (param `OrdersTableName`, default `duokart-orders` per frozen `docs/api-contracts.md`):**
- BillingMode: PAY_PER_REQUEST (no capacity math for demo)
- AttributeDefinitions: `orderId` S; KeySchema: HASH `orderId`
- No sort key (one row per order, status moves forward in place)
- PointInTimeRecovery: on (free-ish, demo-safe)
- Tags: Project DuoKart

**SNS topics (params `BuyerTopicName` default `duokart-dev-buyer`, `OwnerTopicName` default `duokart-dev-owner`):**
- No email hardcoded in template (never commit personal mails). After Create: console → topic → Create subscription → Email → your mails → Confirm via inbox link.
- Worker publishes: buyer = "order received, packing" + bill link; owner = "new order #id, items, total".

**Lambda worker (`duokart-dev-order-worker`):**
- Runtime Python 3.12, Handler `index.handler`, Timeout 30s, Memory 128MB
- Inline `ZipFile` code (console-only constraint — no S3 upload step):
  1. Parse SQS record body → `OrderCreated` JSON
  2. `dynamodb.update_item` with `ConditionExpression = attribute_not_exists(orderId) OR #st = :received` — only forward `RECEIVED → PACKING`, duplicate delivery never moves backward
  3. `sns.publish` to buyer + owner topics
  4. Return batch success; throw on bad payload → SQS retries 3× → DLQ (do **not** swallow errors, or poison orders vanish silently)
- EventSourceMapping: SQS → Lambda, BatchSize 1 (one order per invoke, easy logs for demo), Enabled true
- Env vars from template Refs: `TABLE_NAME`, `BUYER_TOPIC_ARN`, `OWNER_TOPIC_ARN`

**Lambda IAM role (`duokart-dev-worker-role`):**
- Assume: `lambda.amazonaws.com`
- Managed: `AWSLambdaBasicExecutionRole` (CloudWatch Logs)
- Inline `WorkerAccess`: `sqs:ReceiveMessage,DeleteMessage,GetQueueAttributes` on queue + DLQ ARNs; `dynamodb:GetItem,PutItem,UpdateItem,Query` on table ARN only; `sns:Publish` on both topic ARNs only. Least privilege, no `*`.

**SSM params (Type String, same pattern as DB/S3):**
- `/duokart/dev/sqs-queue-url` = queue URL
- `/duokart/dev/sqs-queue-arn` = queue ARN
- `/duokart/dev/ddb-orders-table` = table name
- `/duokart/dev/sns-buyer` = buyer topic ARN
- `/duokart/dev/sns-owner` = owner topic ARN

**Outputs (+ Exports `${AWS::StackName}-*`):**
- `OrdersQueueUrl`, `OrdersQueueArn`, `OrdersDlqArn`, `OrdersTableName`, `OrdersTableArn`, `BuyerTopicArn`, `OwnerTopicArn`, + 5 SSM names.

### Verify Template Locally (no AWS calls)

```bash
python -c "import yaml; yaml.SafeLoader.add_multi_constructor('', lambda l,s,n: None); yaml.safe_load(open('infra/05-queue.yaml')); print('YAML OK')"
python -m py_compile app/app.py; echo "app.py OK"
```

---

## 2. Handoff Rule

Follow the pair programming handoff from `NEW-WORKFLOW.md`:

**Turn 1 (Swapnil):**
- Build SQS + DLQ + DynamoDB + SNS topics + Lambda worker + role + SSM + Outputs
- Test and push directly to `main`

**Turn 2 (Prathamesh):**
- Pull from `main`
- Build app `POST /orders` + `GET /orders/:id` + EC2 IAM SQS/Dynamo rights + UserData queue env vars
- Test and push directly to `main`

**Result:** Both names appear in commit history with alternating commits.

---

## 3. Deploy via Console

### Steps

1. Open AWS Console → CloudFormation → Create stack → Upload `infra/05-queue.yaml`
2. Region: `us-east-2` (Ohio)
3. Stack name: `duokart-05-queue`
4. Parameters: `EnvironmentName=dev`, queue/table/topic names (defaults fine)
5. Capabilities: tick `I acknowledge that AWS CloudFormation might create IAM resources` (Lambda role) → Create → wait `CREATE_COMPLETE`
6. After Create: SNS → each topic → Create subscription → Protocol Email → your buyer/owner mails → Confirm via inbox links (topics stay `PendingConfirmation` until clicked — worker publish still succeeds, mail just doesn't arrive till confirmed)

### What to Watch For

- DynamoDB table: ~30 seconds
- SQS queues: ~30 seconds
- Lambda + EventSourceMapping: ~1 minute (mapping stays `Enabling` briefly, then `Enabled`)
- Total deploy time: ~3-5 minutes
- If `EventSourceMapping` stuck `Enabling` > 5 mins: Lambda role missing `sqs:ReceiveMessage` — check role, not the mapping

---

## 4. Verify the Deployment

### CloudFormation Verification

- [x] Stack Status = `CREATE_COMPLETE` (no `ROLLBACK` events)
- [x] Outputs tab shows queue URL/ARN, table name/ARN, both topic ARNs

### Console Verification

- [x] SQS → `duokart-dev-orders-*` exists, RedrivePolicy shows DLQ + maxReceiveCount 3
- [x] SQS → DLQ exists
- [x] DynamoDB → `duokart-orders` exists, key `orderId` (S), billing on-demand
- [x] SNS → both topics exist, subscriptions `Confirmed` (after inbox clicks)
- [x] Lambda → worker exists, trigger SQS `Enabled`, last invocation `Succeeded` after first test order
- [x] SSM → all 5 params exist with correct values (app fetched them at boot — E2E green)

### App Order Test (Turn 2)

- [x] `POST http://<ALB-DNS>/orders` valid `OrderCreated` → `202 {"orderId","status":"RECEIVED"}` (`ord-000046/48`, `temp.txt` + `e2e-1.png`)
- [x] Re-POST identical body → `202` same id (idempotent)
- [x] Same `orderId` changed payload → `409` (`e2e-2.png`)
- [x] `total` ≠ sum(qty×price) → `400` (`e2e-3.png`)
- [x] `GET /orders/<id>` → `200` with `RECEIVED` then `PACKING` after worker (~5-15s), never backward (`ord-000042/46/48`)
- [x] Buyer + owner mails arrive (SNS) (`order-e2e-mail_2.png` — owner `ord-000048` after delay, see troubleshooting)
- [ ] Bad payload ×3 → message lands in DLQ, site still `200` on new orders (queue buffers)

---

## 5. Update Flask App for Orders

### How it works (simple words)

Buyer flow never waits for packing. App checks the bill math, checks duplicate `orderId` in DynamoDB (same food re-order = OK `202`, same bill number different food = `409`), drops the order in SQS, replies `202 RECEIVED` instantly. Worker (Lambda) picks it up, flips status to `PACKING` in DynamoDB, mails buyer + owner. Status page reads DynamoDB. If worker chokes 3×, order parks in DLQ — site never hangs.

### Add to `app/app.py`

```python
import boto3  # already there from Day 4
from flask import request  # already there

SQS_QUEUE_URL = os.environ.get('SQS_QUEUE_URL', '')
DDB_ORDERS_TABLE = os.environ.get('DDB_ORDERS_TABLE', 'duokart-orders')

def _aws():
    return (
        boto3.client('sqs', region_name='us-east-2'),
        boto3.client('dynamodb', region_name='us-east-2'),
    )

@app.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json(force=True, silent=True) or {}
    # validate OrderCreated per docs/api-contracts.md
    ...

@app.route('/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    # dynamodb.get_item(TableName=DDB_ORDERS_TABLE, Key={'orderId': {'S': order_id}})
    # 404 if missing, else OrderStatus JSON
    ...
```

Full validation rules (frozen contract, both approve changes): `orderId` required (idempotency key); `items` non-empty with `sku/qty/price`; `total == sum(qty*price)` else `400`; `buyerEmail` + `paymentRef` required. `sqs.send_message(MessageBody=json.dumps(data), MessageDeduplicationId=orderId)` — for Standard queue extra param is ignored, harmless.

### Add to `app/requirements.txt`

Nothing new — `boto3` already there from Day 4. Worker needs no new lib.

### EC2 IAM + User-Data (update `infra/02-compute.yaml`)

- Add param `QueueStackName` default `duokart-05-queue`.
- To `Ec2InstanceRole` add policy `OrderApiAccess`: `sqs:SendMessage` on `Fn::ImportValue ${QueueStackName}-OrdersQueueArn`; `dynamodb:GetItem,PutItem,Query` on `Fn::ImportValue ${QueueStackName}-OrdersTableArn`. No receive/delete (only Lambda drains).
- UserData after S3 lines: fetch `SQS_QUEUE_URL` from `/duokart/dev/sqs-queue-url` + `DDB_ORDERS_TABLE` from `/duokart/dev/ddb-orders-table` into `duokart.service`. Keep DB + S3 lines untouched.
- `pip install -r` picks up nothing new.

---

## 6. Troubleshooting

### Issue: EventSourceMapping stuck Enabling

**Root cause:** Lambda role missing `sqs:ReceiveMessage` on the queue ARN, or queue ARN typo.
**Solution:** IAM → worker role → check inline policy covers queue + DLQ ARNs. Mapping flips to Enabled within a minute of fixing — no stack recreate needed.

### Issue: Orders stay RECEIVED, never PACKING

**Root cause:** Lambda crashing (check CloudWatch Logs `/aws/lambda/<worker>`), or SNS publish failing on unconfirmed topic (publish still succeeds — mail just doesn't arrive, status should still flip; if status stuck, it's DynamoDB, not SNS).
**Solution:** Logs first. Common: worker env `TABLE_NAME` empty (template Ref typo) → `ResourceNotFoundException`. Fix template, Update stack, refresh nothing (Lambda updates in place).

### Issue: 409 on every re-POST, even identical

**Root cause:** App compares payload wrong (key order, float total 297.0 vs 297).
**Solution:** Canonicalize: compare `json.dumps(payload, sort_keys=True)` stored vs incoming; compare totals as ints. Contract: same id + same canonical payload = `202`, different = `409`.

### Issue: DLQ filling with good orders

**Root cause:** Worker throws on every message (e.g. SNS topic ARN env wrong → publish throws → whole batch fails → 3 retries → DLQ).
**Solution:** DLQ message body shows the order; CloudWatch Logs shows the exception. Fix worker, then SQS → DLQ → redrive back to source queue (console: Start DLQ redrive) — no data loss by design.

### Issue: No buyer/owner mail

**Root cause:** SNS subscriptions still `PendingConfirmation` (inbox link not clicked) — publish succeeds silently.
**Solution:** SNS → topic → Subscriptions → check `Confirmed`. Resend confirmation, click link, retest. Never hardcode emails in template to "fix" this.

**Night lesson (2026-09-19, `ord-000045`):** owner mail missing while buyer mail + manual owner publish both worked. Cause was delayed delivery / confirm propagation, not the template — mail arrived ~minutes later, and Lambda publishes with no `Subject` so Gmail may file it under Spam/Promotions. Checklist before debugging code: (1) both subs `Confirmed`, (2) owner Spam/Junk for `no-reply@sns.amazonaws.com`, (3) Lambda env `OWNER_TOPIC_ARN` vs stack Output match, (4) CloudWatch Logs for `sns:Publish` deny. Proof: `docs/screenshots/day-5/order-e2e-mail_2.png`.

---

## 7. Evidence Required

Screenshot and commit directly to `main`:

| # | What | Where to Find | Filename |
|---|------|---------------|----------|
| 1 | Stack complete | CloudFormation → duokart-05-queue → stack info | `stack-complete.png` |
| 2 | Queue + redrive | SQS → orders queue → redrive policy (DLQ + 3) | `sqs-queue.png` |
| 3 | Table keys | DynamoDB → duokart-orders → keys + on-demand | `dynamodb-table.png` |
| 4 | Worker trigger | Lambda → worker → SQS trigger Enabled + last run Succeeded | `lambda-worker.png` |
| 5 | Order E2E | POST 202 JSON + GET PACKING JSON + buyer mail | `order-e2e.png` |

Save to `docs/screenshots/day-5/` and push directly to `main`.

---

## 8. Cost Impact

| Resource | Cost | Notes |
|----------|------|-------|
| SQS (few 1000 msgs) | ~$0.00/day | First 1M/month free |
| Lambda (128MB, ~100 invokes) | ~$0.00/day | Free tier covers demo |
| DynamoDB on-demand (tiny rows) | ~$0.00/day | Cents per 100k writes |
| SNS mails (few 10s) | ~$0.00/day | Pennies per 1000 |
| RDS + NAT + ALB + EC2 | ~$3.01/day | From Day 4, unchanged |
| S3 (photos + retained bills) | ~$0.00/day | Retained bills object ~cents |
| **Total Day 5** | **~$3.01/day** | Queue tier adds ~zero |

**Nightly policy:** Delete `duokart-05-queue` first (Lambda trigger disables, SQS/Dynamo/SNS delete cleanly — no lock pain unlike bills), then `03-data` (~5-10 mins RDS), then `02-compute`. Keep `01-vpc` + `04-storage` (storage retained by decision — no S3 emptying). Verify: Lambda 0, SQS 0, DynamoDB 0, RDS 0, EC2 0, S3 2 buckets (photos + bills).

---

## 9. Nightly Teardown

1. CloudFormation → `duokart-05-queue` → Delete stack → wait complete (~2 mins, cleanest stack)
2. CloudFormation → `duokart-03-data` → Delete (~5-10 mins RDS)
3. CloudFormation → `duokart-02-compute` → Delete (~2-3 mins)
4. Keep `duokart-01-vpc` + `duokart-04-storage` (storage retained by decision — no S3 emptying)
5. Verify: Lambda 0, SQS 0, DynamoDB 0, RDS 0, EC2 0, S3 2 buckets (photos + bills)

---

## 10. Definition of Done

- [x] `infra/05-queue.yaml` written and YAML-validated locally
- [x] Template pushed directly to `main`
- [x] Stack deployed as `duokart-05-queue` in `us-east-2`
- [x] Stack Status = `CREATE_COMPLETE`
- [x] SQS redrive 3× → DLQ verified in console
- [x] DynamoDB `duokart-orders` PK `orderId` on-demand verified
- [x] Lambda SQS trigger `Enabled`, last run `Succeeded`
- [x] App `POST /orders` 202 / idempotent-202 / 409 / 400 per contract
- [x] `GET /orders/:id` moves RECEIVED → PACKING, never backward
- [x] Buyer + owner mails arrive (subscriptions Confirmed)
- [ ] Day 4 endpoints still green (`/health connected`, `/products Neem Soap`, presigned photo + bill)
- [x] 5 screenshots captured and committed (`aca7d6d` + `00530ab`)
- [x] Troubleshooting notes filled (owner-mail delay lesson, §6)
- [x] Cost impact documented

---

## Day 6 Starting Point

Observe tier: CloudWatch alarms (ALB 5xx, RDS CPU, SQS age, DLQ depth, Lambda errors) + dashboard + CloudTrail + Budgets 60/100. See `docs/day-6-observe.md` (when created).

**What you'll need from today:**
- Queue URL/ARN, table name, topic ARNs (for alarm dimensions)
- VPC/ALB/RDS names (for alarm targets)
- Worker log group name (for error alarm)
