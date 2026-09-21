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

### 1. SecureString migration (highest-signal security fix left)

`docs/day-3-data.md` still has `Type: SecureString` unchecked — `/duokart/dev/db-password` is a plain `String` (visible in console).

1. `infra/03-data.yaml`: `DBPasswordParam` → `Type: SecureString` (keep same `Name`, same `Value: !Ref DBPassword`).
2. Local check: `python -c` with CFN `!` ignore → `YAML OK`.
3. Commit + push: `fix(day3): store db password as SecureString`.
4. Console: `duokart-03-data` → Update → Replace template → same `DBPassword` value re-pasted (update needs the param again) → `UPDATE_COMPLETE` (SSM param type replaces; RDS password untouched since value identical).
5. Verify: SSM → `/duokart/dev/db-password` → Type `SecureString`, value hidden. ASG refresh (new instances fetch with `--with-decryption` — UserData already does), `/health connected`.

### 2. Kill-1-EC2 self-heal drill (fills `architecture.md` evidence box)

1. EC2 → Instances → terminate 1x `duokart-dev-app` → screenshot instance `shutting-down`.
2. ASG → Activity history → `Successful` launch → Target Group back to 2x `healthy`.
3. Throughout: `curl http://<ALB-DNS>/` loop still `200` (ALB + ASG story proven live).
4. Save to `docs/screenshots/day-7/` as `self-heal.png`.

### 3. Bills delete-denied proof (matches `demo-script.md` shot 4)

1. S3 → check orphan `duokart-dev-bills-ps-18` with locked `bills/test.txt`: if it exists → Delete → screenshot denial as `bills-locked-proof.png` (proves Day 4 lock).
2. If orphan expired/gone: S3 → live `duokart-dev-bills-ps-19` → show versioned bill + presigned PUT works → save same filename + one-line note in README tradeoffs that `ps-19` dropped the lock for dev cleanup (Day 4 lock pain).

Done when: SecureString verified + service healthy, self-heal screenshots show terminate → replace → still-200, lock-denial captured.

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

- [ ] `/duokart/dev/db-password` is `SecureString`, app healthy after refresh
- [ ] `self-heal.png` (terminate → ASG replace → still-200) committed
- [ ] `bills-locked-proof.png` (delete denied) committed
- [ ] README rewritten (problem, stack, cost, proof in 30s) + `Who did what` real + tradeoffs table
- [ ] `architecture.png` committed, all `docs/screenshots/day-*` pushed
- [ ] Fork verified with both histories
- [ ] `destroy-checklist.md` executed, billing screenshot saved
- [ ] Both names in commit history through the final commit
