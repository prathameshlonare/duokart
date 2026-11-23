# RUNBOOK 03: SQS Dead-Letter Queue (DLQ) & Poison Message Triage

* **Severity**: Medium / High (P2)
* **Affected Components**: Amazon SQS, AWS Lambda (Order Worker), Amazon DynamoDB (`duokart-orders`), Amazon SNS
* **Primary Metric**: `AWS/SQS` `ApproximateNumberOfMessagesVisible` on `duokart-orders-dlq`

---

## 1. Alert Trigger & Incident Symptoms

This runbook activates when:
* CloudWatch alarm `duokart-dev-dlq-depth` fires: `ApproximateNumberOfMessagesVisible > 0` on `duokart-orders-dlq` for 1 evaluation period (5 minutes).
* Order fulfillment metrics lag or specific customers report orders remaining stuck in `RECEIVED` state without progressing to `PACKING`.
* CloudWatch Lambda alarm `duokart-dev-worker-errors` reports function execution failures (`Errors > 0`).

---

## 2. Mechanical Breakdown: Poison Pills & The Redrive Policy

1. **Decoupled Architecture**: In DuoKart, the Flask web application immediately accepts incoming customer orders with `202 ACCEPTED` and pushes the payload to `duokart-orders-main`. An asynchronous Lambda worker drains the queue, updates status in DynamoDB, and dispatches SNS notifications.
2. **The Poison Pill Problem**: If a client submits a corrupted payload (missing required fields, negative totals, malformed types), the Lambda worker throws an unhandled exception during schema validation.
3. **Head-of-Line Blocking**: Without a Dead-Letter Queue, a failing message returns to the queue after the visibility timeout expires and retries endlessly. This starves downstream valid orders and saturates Lambda concurrency.
4. **The Redrive Policy (`maxReceiveCount = 3`)**: Amazon SQS tracks processing attempts via `ApproximateReceiveCount`. After 3 consecutive failed receives, SQS isolates the message into `duokart-orders-dlq`. The primary pipeline continues serving valid orders with zero customer disruption.

---

## 3. Immediate Diagnostic Flowchart

```
[Alarm: DLQ Depth > 0 Fires]
              │
              ▼
[Inspect Dead-Letter Queue via CLI / Console]
Check ApproximateNumberOfMessagesVisible
              │
              ▼
[Extract Poison Payload WITHOUT Deleting]
Inspect message attributes & JSON body
              │
              ▼
[Correlate with Lambda CloudWatch Logs]
Filter /aws/lambda/duokart-dev-order-worker for ERROR / Traceback
              │
              ▼
[Determine Root Cause]
              ├─────────────────────────────────────────┐
              ▼                                         ▼
[Malformed Client Payload]                 [Worker Logic / Schema Bug]
Identify offending client/API              Deploy hotfix to Lambda worker
              │                                         │
              └────────────────────┬────────────────────┘
                                   │
                                   ▼
                   [Execute DLQ Redrive Protocol]
                   Redrive to duokart-orders-main
                                   │
                                   ▼
                   [Verify DLQ Returns to 0 & Alarm OK]
```

---

## 4. Empirical Fault-Injection Evidence

### Step 1: Queue Architecture Configuration
The primary order queue is configured with an explicit Redrive Policy targeting the DLQ with `maxReceiveCount = 3`:

```text
[+] Dead-Letter Queue Created: https://sqs.us-east-2.amazonaws.com/123456789012/duokart-orders-dlq
    DLQ ARN: arn:aws:sqs:us-east-2:123456789012:duokart-orders-dlq
[+] Main Orders Queue Created: https://sqs.us-east-2.amazonaws.com/123456789012/duokart-orders-main
    Redrive Policy configured: maxReceiveCount=3 -> arn:aws:sqs:us-east-2:123456789012:duokart-orders-dlq
```

### Step 2: Poison Pill Injection
A corrupted order payload containing a negative total is injected into the primary order queue:

```text
[+] Poison Message Injected into Main Queue:
    MessageId: a3c6038b-eaa7-4d71-9b92-50c99b81e251
    Body: {"orderId": "ord-99999", "error": "corrupted_payload", "total": -100}
```

### Step 3: Simulated Worker Retries & Redrive Isolation
The worker receives the message, crashes during validation, and fails to delete it. SQS tracks the retry count:

```text
[*] Simulating Worker Consumer Processing & Retries:
    -> [Attempt 1] Worker received MessageId: a3c6038b-eaa7-4d71-9b92-50c99b81e251 (ReceiveCount: 1)
       ERROR: Schema validation failed! Worker crashed before deleting message.
    -> [Attempt 2] Worker received MessageId: a3c6038b-eaa7-4d71-9b92-50c99b81e251 (ReceiveCount: 2)
       ERROR: Schema validation failed! Worker crashed before deleting message.
    -> [Attempt 3] Worker received MessageId: a3c6038b-eaa7-4d71-9b92-50c99b81e251 (ReceiveCount: 3)
       ERROR: Schema validation failed! Worker crashed before deleting message.

[*] Worker polls Main Queue on 4th attempt (triggering redrive evaluation):

[*] Queue State Inspection:
    Main Queue Messages Visible: 0
    DLQ Messages Visible: 1
```

### Step 4: Forensic Payload Inspection
The message is safely preserved in the DLQ for forensic debugging:

```text
[!] DLQ Forensic Inspection:
    DLQ MessageId: a3c6038b-eaa7-4d71-9b92-50c99b81e251
    Final ApproximateReceiveCount: 4
    Extracted Poison Body: {"orderId": "ord-99999", "error": "corrupted_payload", "total": -100}

[OK] Fault isolation confirmed: Primary pipeline unblocked.
```

---

## 5. Triage & Remediation Procedure

### Step 1: Inspect DLQ Queue Depth via AWS CLI
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-2.amazonaws.com/<ACCOUNT_ID>/duokart-dev-orders-dlq \
  --attribute-names ApproximateNumberOfMessages
```

### Step 2: Read the Poison Payload Without Deleting
Never delete DLQ messages during triage. Read the message while leaving it intact in the queue:
```bash
aws sqs receive-message \
  --queue-url https://sqs.us-east-2.amazonaws.com/<ACCOUNT_ID>/duokart-dev-orders-dlq \
  --attribute-names All \
  --visibility-timeout 30 \
  --max-number-of-messages 1
```

### Step 3: Correlate with Worker Lambda Logs
Search the Lambda function log stream for the corresponding `MessageId` or unhandled Python exception:
```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/duokart-dev-order-worker \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)
```

### Step 4: Apply Code Fix or Schema Hotfix
If the failure is caused by an unhandled edge case in Lambda code (e.g. handling optional discount codes or currency fields), update the worker code:
```bash
aws lambda update-function-code \
  --function-name duokart-dev-order-worker \
  --zip-file fileb://worker.zip
```

### Step 5: Execute the DLQ Redrive Protocol
Once the application code or data validator is updated, redrive messages back to the primary queue:

* **Via AWS Management Console**:
  1. Open **Amazon SQS** $\rightarrow$ select `duokart-dev-orders-dlq`.
  2. Click **Start DLQ redrive** (top right).
  3. Select **Redrive to source queue** $\rightarrow$ click **Start DLQ redrive**.

* **Via AWS CLI**:
```bash
aws sqs start-message-move-task \
  --source-arn arn:aws:sqs:us-east-2:<ACCOUNT_ID>:duokart-dev-orders-dlq \
  --destination-arn arn:aws:sqs:us-east-2:<ACCOUNT_ID>:duokart-dev-orders-main
```

---

## 6. Post-Redrive Verification

1. **Verify DLQ Depth Returns to Zero**:
   ```bash
   aws sqs get-queue-attributes \
     --queue-url https://sqs.us-east-2.amazonaws.com/<ACCOUNT_ID>/duokart-dev-orders-dlq \
     --attribute-names ApproximateNumberOfMessages
   ```
2. **Verify DynamoDB State Progression**:
   Query DynamoDB table `duokart-orders` for the redriven `orderId` to verify status flipped from `RECEIVED` to `PACKING`.
3. **Verify Alarm State**:
   Confirm that CloudWatch alarm `duokart-dev-dlq-depth` transitions back to `OK`.
