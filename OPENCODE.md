# OpenCode Instructions — DuoKart

You are working on DuoKart, a two-person AWS learning and portfolio project.
Your job is not to blindly generate code. Help two humans build a working system while preserving understanding, evidence, security, cost control, and equal contribution.

`AGENTS.md` is the authority. This file is the operating manual. On conflict, AGENTS.md wins.

**Stack:** Python (Flask/FastAPI app + boto3 Lambda). **Region:** `us-east-2` (Ohio).
**Account:** Swapnil's (credits expiring — destroy fast). **AWS mode:** Console-only, no CLI, no access keys.
**Local default:** `AWS_MODE=local` (SQLite + `./uploads` + in-memory queue). AWS only for demo.

## Map
- `AGENTS.md` — hard rules (region, budget, git, secrets, IaC, done criteria).
- `duokart-project.md` — idea in plain words. `duokart-context.md` — team decisions.
- `docs/api-contracts.md` — frozen. Changes need `docs/architecture-decisions.md` entry + both approve.
- `docs/aws-scope.md` — mandatory / deferred / doc-only service list.
- `docs/day-0-setup.md` → `docs/day-1-network.md` — follow only the current day doc.
- `docs/deployment.md` — console deploy order. `docs/destroy-checklist.md` — destroy order.
- `docs/cost-log.md` — budget proof. `docs/contribution-log.md` — 50/50 proof.
- `infra/` — CloudFormation YAML, numbered `01-vpc.yaml 02-alb.yaml 03-data.yaml 04-queue.yaml 05-observe.yaml`.
- `app/` — Flask web. `worker/` — Lambda order worker. `scripts/` — helpers (no AWS calls).

## Before every task, read in order
1. `AGENTS.md` 2. `duokart-context.md` 3. `duokart-project.md`
4. `docs/api-contracts.md` + `docs/aws-scope.md`
5. The current `docs/day-*.md` — follow only it unless asked otherwise.

## Operating mode
Understand → inspect repo → plan → ask if architecture is affected → smallest useful change → test → document → summarize evidence. Never jump straight to implementation.

## Architecture protection
Provisional, not immutable. If a request touches AWS services, DB choice, API contracts, networking, security, cost, contribution split, or deployment model — stop and explain impact before editing. Never silently swap EC2↔ECS, RDS↔DynamoDB, SQS↔direct invoke, CloudFormation↔Terraform, IAM roles↔access keys. Both contributors approve first, logged in `docs/architecture-decisions.md`.

## AWS rules
Console-only in `us-east-2`. CloudFormation YAML, least privilege, no hardcoded credentials, no secrets in git. One NAT max, small single-AZ infra, destroy idle billable resources. Tag everything: `Project=DuoKart`, `Environment=dev`, `ManagedBy=CloudFormation`. Deploying a template via Console upload is required — click-designing infra outside `infra/` is forbidden.

## Code rules
Python only. FastAPI or Flask consistently. Type hints where practical, small functions, clear names, validate inputs, handle AWS errors explicitly, structured logging. No new framework without a logged reason.

## API rules
Read `docs/api-contracts.md` before touching payloads. Contract change = explain why → update contract first → update producer + consumer → update/add tests → log in `docs/architecture-decisions.md`.

## Infra rules
Every template: parameters where appropriate, outputs for key IDs, tags, clear logical IDs, comments on non-obvious config, minimal permissions, no hardcoded values.

## Testing rules
Test before claiming done: syntax/import, unit tests, endpoint tests, template validation (Console designer validate or `cfn-lint` locally — no AWS calls). If AWS isn't deployed, say so; never claim a deployment without console evidence (screenshot/stack status in PR).

## Documentation rules
After implementing: what changed, why, how to run/test, evidence, limitations, cost/security notes. Per-service docs per AGENTS.md §9.

Thoroughness standard: every generated day doc or file must let the other contributor execute with zero guesswork — no skim-level bullets. Day docs need objective, prerequisites, per-person what/how/document/push tables with exact commands or console paths, verification with expected outputs, evidence list, cost impact, done checklist. Files need purpose, full working content, run/verify steps, and links to neighbors. Unknowns become named open questions with owner + date, never silent omissions.

## Team contribution
Genuine 50/50. No giant single-person branches. Suggested split (adjustable, log in `contribution-log.md`): Prathamesh — networking, IAM baseline, CFN foundation, backend/API. Swapnil — app deploy, DB integration, SQS/Lambda/DynamoDB worker. Both — testing, docs, monitoring, review, teardown.

## Commands
- Local run: `python -m app.run` (uses `.env`, `AWS_MODE=local`)
- Tests: `pytest`
- Git: branches `p/*` + `s/*`, PR-only to `main`, other person reviews, no squash. Format `type(scope): description`.
- Verify secrets: `git check-ignore .env` must print `.env`.

## Response style
Be direct. For every implementation report: plan, files affected, AWS resources affected, cost impact, security impact, testing required, documentation required. If unnecessary, say so. If risky, stop and flag. If out of scope, recommend documenting instead.

## Final rule
Build only what can be explained, tested, documented, and defended in an interview.

## Day 0 done-when
Both IAM console logins pass, budget alarms visible, empty EC2/RDS/ALB screenshots in us-east-2.
