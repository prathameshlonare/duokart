# DuoKart — Small Shop Order + Bill Manager

**One line:** bills never lost, site stays up in festival rush.
**Team:** Prathamesh + Swapnil (50/50 real split, alternating commits per `NEW-WORKFLOW.md`).
**Status:** Day 7 ship — morning self-heal proven (`docs/screenshots/day-7/`), README polish in progress. No new infra.
**Stack:** Python Flask · AWS us-east-2 (Ohio) · CloudFormation YAML · Console-only (no CLI, no keys).
**Cost:** ~$3.01/day when up; nightly teardown rule — delete `02-compute` + `03-data` + `05-queue` each evening, keep `01-vpc` + `04-storage` (`ps-19`); re-upload next morning. Biggest burners: RDS Multi-AZ + ALB + NAT.
**Proof:** `docs/architecture.md` (diagram + self-heal) · `docs/demo-script.md` (60-sec shots) · day docs `docs/day-0-setup.md` → `docs/day-7-ship.md` · screenshots `docs/screenshots/`.

## Why this exists

Learning project by two close friends targeting the same career path (AWS / DevOps): Swapnil (learned AWS at an institute) + Prathamesh (self-taught during a 100-days-of-DevOps journey). Deliberate decision: not another tutorial-copy fresher project — a real shop system where every tier was actually broken and fixed by hand (see `Tradeoffs` + day docs). No external demo, no real users; built to be GitHub- and resume-worthy. Full background + ship plan: `docs/day-7-ship.md`.

## What this is
One shop link: bills never lost, site stays up in festival rush. See `duokart-project.md`.

## Repo rules
- Direct pushes to `main` — no PRs required (per `NEW-WORKFLOW.md`).
- AWS is temporary; this repo is permanent. Destroy order in `docs/destroy-checklist.md`.

## Map
- `duokart-project.md` — idea in plain words
- `NEW-WORKFLOW.md` — simplified workflow and handoff rules
- `docs/api-contracts.md` — frozen contracts · `docs/aws-scope.md` — service scope
- `docs/day-0-setup.md` → `docs/day-1-network.md` → `docs/day-2-compute.md` → `docs/day-3-data.md` → `docs/day-4-storage.md` → `docs/day-5-queue.md` → `docs/day-6-observe.md` (+ execution plans `day-3-execution-plan.md`, `day-4-execution-plan.md`, `day-5-execution-plan.md`, `day-6-execution-plan.md`) → `docs/day-7-ship.md` — day docs
- `docs/deployment.md` — console deploy order · `docs/destroy-checklist.md` — destroy order
- `docs/architecture.md` — diagram · `docs/demo-script.md` — demo video plan
- `infra/` — CloudFormation stacks (day 1+)
- `app/` — Python Flask app

## Proof
- [ ] Diagram in `docs/architecture.md` (`architecture.png` pending)
- [ ] 60-sec video link in `docs/demo-script.md`
- [X] Day 0-3 screenshots in `docs/screenshots/`
- [X] Day 7 self-heal shots in `docs/screenshots/day-7/` (`self-heal.png`, `self-heal-replace.png`)

## Who did what (receipt: alternating history, ~30 Prathamesh / ~19 Swapnil)

- Swapnil: Day 1 VPC branch, Day 2 ALB half, Day 3 RDS Multi-AZ + SSM template, Day 4 S3 photos + locked bills buckets, Day 5 queue infra (SQS + DLQ + DynamoDB + SNS + Lambda) + queue proof shots, Day 6 observe tier (8 alarms + dashboard + trail + budget + 6 shots), Day 7 morning self-heal drill + SecureString attempt/revert.
- Prathamesh: Day 2 ASG half + Flask app + outputs/wiring, Day 3 Flask RDS wiring + SSM auto-fetch + 5 proof shots + docs, Day 4 presigned uploads + regional S3 endpoint fix + checksum fix + ps-19 no-lock cleanup + storage proof shots, Day 5 order counter + status board + queue auto-fetch + e2e proof (ord-000048 PACKING) + docs, Day 6 observe plan + DLQ alarm mail + trail proof, showcase tour + day index + Day 7 ship plan + this README.

## Tradeoffs we made (every row is a real war story)

| Decision | Chose | Rejected | Why |
|----------|-------|----------|-----|
| Bills retention | `ps-19` versioned, no lock (`Delete` policy) | Compliance 30d (`ps-18` orphan) | Lock blocked nightly delete + forced bucket churn; kept `ps-18` orphan till expiry, ship on clean `ps-19` |
| SSM password type | `String` | `SecureString` | CFN `AWS::SSM::Parameter` doesn't accept `SecureString` — only `String`/`StringList` enum values; deploy rejected |
| Queue type | Standard SQS | FIFO | Throughput over ordering; idempotency via `orderId` |
| Poison handling | DLQ after 3 receives | Retry forever / drop | Counter never jams, no silent loss, redrive possible |
| Bill uploads | Presigned + client SHA-256 checksum | App proxies bytes | App never touches bytes; S3 Object Lock *requires* checksum header |
| Presigned endpoint | Force `s3.us-east-2` virtual-hosted | boto3 default | Default signed `s3.amazonaws.com` → `TemporaryRedirect` |
| DB password charset | `A-Z a-z 0-9 - _ ! #` | Full symbol set | `%`-leading password got mangled by systemd specifier expansion |
| Domain / WAF / 2nd NAT / CRR | Deferred (see `aws-scope.md`) | Build now | No real users; cost + complexity with zero signal |
