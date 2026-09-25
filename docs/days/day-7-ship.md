# Day 7 — Resume-Ship Day (no new infra)

## Why this day exists

DuoKart is a learning project built by two close friends targeting the same career path (AWS / DevOps): Swapnil (learned AWS at an institute) + Prathamesh (self-taught during a 100-days-of-DevOps journey). Deliberate decision: not another tutorial-copy "AWS cloud DevOps project" every fresher makes — a real shop system (VPC → ALB/ASG → RDS → S3 presigned + locked bills → SQS → Lambda → DynamoDB → SNS → alarms) where every tier was actually broken and fixed by hand.

There is **no external demo and no real users**. The two readers that matter:
- Recruiter skimming the README for 30 seconds → must grasp problem, stack, cost, proof instantly.
- Interviewer digging commit history for 30 minutes → every claim must click through to a screenshot + a commit from each of us (alternating history per `NEW-WORKFLOW.md` handoff rule).

Day 7 adds zero AWS resources. It closes the one open security item, captures the three proofs interviewers always ask for, polishes the repo into a portfolio piece, forks it, and destroys everything with a final billing screenshot.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**Requires: `01-vpc` + `04-storage` (`ps-19`, no lock) kept up; morning rebuild `02-compute` → `05-queue` → `03-data` + smoke. `06-observe` stays deleted — alarm mail + dashboard + trail shots from Day 6 are the proof, no re-deploy.**

---

## Morning — Swapnil: close + prove (about 1 hour)

### 1. ~~SecureString migration~~ SKIPPED — CFN doesn't support it

**Attempted and failed:** CloudFormation `AWS::SSM::Parameter` does not accept `SecureString` — only `String` and `StringList` are valid enum values. Deploy rejected with `Validation failed: SecureString is not a valid enum value`.

- `docs/days/day-3-data.md` `Type: SecureString` checkbox stays unchecked — known limitation.
- `/duokart/dev/db-password` remains `String` in SSM.
- Note this as a tradeoff row in the README (Prathamesh's section).
- Commit: `fix(day3): revert SSM param to String — CFN doesn't support SecureString`.

### 2. Kill-1-EC2 self-heal drill (fills `architecture.md` evidence box)

1. EC2 → Instances → terminate 1x `duokart-dev-app` → screenshot instance `shutting-down`.
2. ASG → Activity history → `Successful` launch → Target Group back to 2x `healthy`.
3. Throughout: `curl http://<ALB-DNS>/` loop still `200` (ALB + ASG story proven live).
4. Save to `docs/screenshots/day-7/` as `self-heal.png`.

### 3. ~~Bills delete-denied proof~~ SKIPPED — ps-19 has no Object Lock

**Why skipped:** `ps-18` (Compliance 30d lock) orphan is gone. Current live bucket `duokart-dev-bills-ps-19` was created **without Object Lock** so that nightly `DELETE` can clean it up during full destroy. A locked bucket cannot be deleted even when empty — Day 4 lock pain taught us this.

- No `bills-locked-proof.png` — lock proof not possible on `ps-19`.
- README tradeoffs table already explains the `ps-19` no-lock decision.
- Instead: verify presigned PUT still works on `ps-19` as a smoke test (optional).

Done when: service healthy after rebuild, self-heal screenshots show terminate → replace → still-200. SecureString and bills-lock skipped (see notes above).

---

## Afternoon — Prathamesh: the README that sells it (about 1 hour)

### 1. Rewrite `README.md` top for the 30-second skim

Keep it short: one-line problem ("bills never lost, site stays up in festival rush"), stack line, live status, cost table (~$3.01/day, nightly teardown rule), links to `architecture.md` diagram + `demo-script.md` + day docs. Recruiter must get it without opening any other file.

### 2. Fill `Who did what` with real turns

Both names + actual components (Swapnil: ALB half, data template, storage buckets, queue infra… / Prathamesh: ASG half, outputs + app wiring, presigned + checksum fix, order counter…). The alternating commit history is the receipt — make the text match it.

### 3. Add `Tradeoffs we made` section (interview fuel — every row is a real war story)

| Decision | Chose | Rejected | Why |
|----------|-------|----------|-----|
| Bills retention | `ps-19` versioned, no lock (`Delete` policy) | Compliance 30d (`ps-18` orphan) | Lock blocked nightly delete + forced bucket churn; kept `ps-18` orphan till expiry, ship on clean `ps-19` |
| SSM password type | `String` | `SecureString` | CloudFormation `AWS::SSM::Parameter` doesn't accept `SecureString` — only `String`/`StringList` enum values; deploy rejected |
| Queue type | Standard SQS | FIFO | Throughput over ordering; idempotency via `orderId` |
| Poison handling | DLQ after 3 receives | Retry forever / drop | Counter never jams, no silent loss, redrive possible |
| Bill uploads | Presigned + client SHA-256 checksum | App proxies bytes | App never touches bytes; S3 Object Lock *requires* checksum header |
| Presigned endpoint | Force `s3.us-east-2` virtual-hosted | boto3 default | Default signed `s3.amazonaws.com` → `TemporaryRedirect` |
| DB password charset | `A-Z a-z 0-9 - _ ! #` | Full symbol set | `%`-leading password got mangled by systemd specifier expansion |
| Domain / WAF / 2nd NAT / CRR | Deferred (see `aws-scope.md`) | Build now | No real users; cost + complexity with zero signal |

### 4. Diagram + fork

- Commit `docs/architecture.png` (clean boxes-and-arrows export matching `architecture.md` text) — closes the last unchecked Proof box alongside the Day 7 self-heal shots.
- Prathamesh forks the repo; verify his commits travel (the 50/50 proof per `NEW-WORKFLOW.md`).

Done when: README answers problem/stack/cost/proof in 30s, tradeoffs table matches screenshots + commits, diagram committed, fork verified.

---

## Explicitly skipped (and why — senior answer, not an omission)

- Real domain purchase + Route53 + ACM HTTPS: no users, nothing to serve over TLS; documented in `aws-scope.md`.
- WAF on ALB (~$1/mo + per-request): answers bot traffic we don't have.
- Second NAT (~$1/day, doubles the biggest burner): AZ-survival for a demo stack burned nightly.
- S3 CRR / CloudFront / SES: DR and mail-formatting for a shop with no customers; SNS is enough per scope.

---

## Full destroy (close the week)

After fork verified: `02-compute` → `05-queue` → `03-data` → `01-vpc` → `04-storage` (06-observe already deleted Day 6 night). `02` before `05` — it imports `05` exports. Final Billing screenshot, fill destroyer + date. `ps-19` has `Delete` policy so no retained object (unlike `ps-18` orphan).
---

## Definition of Done for Day 7

- [x] `/duokart/dev/db-password` stays `String` — CFN `AWS::SSM::Parameter` doesn't support `SecureString` (known limitation, noted in tradeoffs)
- [ ] `self-heal.png` (terminate → ASG replace → still-200) committed
- [ ] `bills-locked-proof.png` skipped — `ps-19` has no Object Lock (needed for clean destroy)
- [ ] README rewritten (problem, stack, cost, proof in 30s) + `Who did what` real + tradeoffs table (incl. SecureString + no-lock rows)
- [ ] `architecture.png` committed, all `docs/screenshots/day-*` pushed
- [ ] Fork verified with both histories
- [ ] `destroy-checklist.md` executed, billing screenshot saved
- [ ] Both names in commit history through the final commit
