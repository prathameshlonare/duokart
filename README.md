# DuoKart — Small Shop Order + Bill Manager

**Team:** Prathamesh + Swapnil (50/50 real split).
**Status:** Day 3 — RDS + SSM + auto-fetch complete, verified `/health connected` + `/products Neem Soap`. Next: Day 4 (S3 storage).
**Stack:** Python · AWS us-east-2 (Ohio) · CloudFormation YAML · Console-only (no CLI).

## What this is
One shop link: bills never lost, site stays up in festival rush. See `duokart-project.md`.

## Repo rules
- Direct pushes to `main` — no PRs required (per `NEW-WORKFLOW.md`).
- AWS is temporary; this repo is permanent. Destroy order in `docs/destroy-checklist.md`.

## Map
- `duokart-project.md` — idea in plain words
- `NEW-WORKFLOW.md` — simplified workflow and handoff rules
- `docs/api-contracts.md` — frozen contracts · `docs/aws-scope.md` — service scope
- `docs/day-0-setup.md` → `docs/day-1-network.md` → `docs/day-2-compute.md` → `docs/day-3-data.md` → `docs/day-4-storage.md` — day docs
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
