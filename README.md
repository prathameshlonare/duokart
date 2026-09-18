# DuoKart — Small Shop Order + Bill Manager

**Team:** Prathamesh + Swapnil (50/50 real split).
**Status:** Day 4 — S3 presigned + locked bills complete, verified photo + bill PUT. Next: Day 5 (queue: SQS → Lambda → DynamoDB → SNS).
**Stack:** Python · AWS us-east-2 (Ohio) · CloudFormation YAML · Console-only (no CLI).

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
- `docs/day-0-setup.md` → `docs/day-1-network.md` → `docs/day-2-compute.md` → `docs/day-3-data.md` → `docs/day-4-storage.md` → `docs/day-5-queue.md` (+ execution plans `day-3-execution-plan.md`, `day-4-execution-plan.md`, `day-5-execution-plan.md`) → `docs/day-7-ship.md` — day docs
- `docs/deployment.md` — console deploy order · `docs/destroy-checklist.md` — destroy order
- `docs/architecture.md` — diagram · `docs/demo-script.md` — demo video plan
- `infra/` — CloudFormation stacks (day 1+)
- `app/` — Python Flask app

## Proof (filled at end)
- [ ] Diagram in `docs/architecture.md`
- [ ] 60-sec video link in `docs/demo-script.md`
- [X] Day 0-3 screenshots in `docs/screenshots/`

## Who did what
- Prathamesh: _fill_
- Swapnil: _fill_
