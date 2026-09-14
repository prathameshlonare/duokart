# Day 0 — Project Bootstrapping and Readiness

## Objective

Prepare both contributors, the repository, dev environments, AWS account, architecture decisions, and docs system.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**No AWS application infrastructure on Day 0.** Do not create: EC2, ALB, ASG, RDS, NAT Gateway, Lambda, SQS, DynamoDB tables, production S3 buckets. Preparation only.

---

## 1. Together — Repository and Team Setup

### GitHub repository
- [ ] Create the DuoKart repo (Swapnil owner — his AWS holds the expiring credits) + Prathamesh as collaborator.
- [ ] Both can clone and push branches. Protect `main`: PR-only, 1 review required, no direct pushes, no squash.
- [ ] Branch convention: `p/*` (Prathamesh), `s/*` (Swapnil).

### Initial push
- [ ] Push all Day 0 files. Confirm present: README, `AGENTS.md`, `OPENCODE.md`, `duokart-context.md`, `duokart-project.md`, `docs/api-contracts.md`, `docs/aws-scope.md`.

### Git security check
```bash
git check-ignore .env
git status
```
Expected: first command prints `.env`; second shows no credentials or private config.

---

## 2. Together — Local Development Environment

Both machines need: Git, Python 3.x + pip, OpenCode, VS Code (or preferred editor). No AWS CLI — console-only project.
```bash
git --version
python --version
pip --version
opencode --version
```
If the OpenCode command differs on a machine, document the working command in the PR.

Python env inside repo (never commit `.venv`):
```bash
python -m venv .venv
```
Windows PowerShell: `.venv\Scripts\Activate.ps1`. Verify with `python --version` + `pip list`.

---

## 3. Together — AWS Account Preparation (Console, us-east-2)

- [ ] Use only `us-east-2` (Ohio). Set region selector in Console; every CloudFormation stack later targets it.
- [ ] Root MFA on (Swapnil's account). Root access keys must not exist. Never use root for daily work.
- [ ] Create IAM users `prathamesh` + `swapnil`: console passwords only, no access keys, least privilege. No credential sharing.
- [ ] Each contributor logs in to Console as own IAM user in us-east-2 — landing page loads = verified. Save account ID privately; never commit IDs or secrets.

---

## 4. Together — Budget and Cost Protection

Shared budget: $130 max (Swapnil's, expiring — destroy fast). Warn $60, stop-and-destroy $100.
- [ ] Budget alerts at 60 + 100 to both emails (Console: Billing → Budgets). Screenshot into `docs/cost-log.md`.
- [ ] Record in `docs/cost-log.md`: amount, thresholds, date, Swapnil as billing owner, who presses destroy.
- [ ] No billable infra today. Idle rule going forward: if not demoing within 24h, delete ALB/RDS/NAT stacks.

---

## 5. Together — Freeze the Initial Architecture

Mandatory (see `docs/aws-scope.md`): IAM, VPC, EC2, ALB, ASG, RDS MySQL, S3, SQS, Lambda, DynamoDB, SNS (buyer + owner), SSM Parameter Store, CloudFormation, CloudWatch, CloudTrail, Budgets.

Deferred (doc-only, need both to approve): Route 53 real domain, ECS/Fargate/ECR, Beanstalk, Cognito, SES (SNS email is enough), WAF, ElastiCache, RDS Multi-AZ, S3 CRR, multi-NAT, Payment Gateway, CloudFront.

Architecture is approved for Day 1 but can change — any change gets a row in `docs/architecture-decisions.md` (title, date, proposer, reason, services/cost/security/implementation impact, both approve) before implementation.

---

## 6. Together — Resolve API Contract + Notification Decisions

Review `docs/api-contracts.md` and confirm:
- [ ] `OrderCreated` payload final for MVP; `orderId` is the idempotency key.
- [ ] Duplicate SQS delivery must not double-process; DynamoDB transitions forward-only.
- [ ] Uploads use presigned URLs; app never proxies file bytes.

**Notification decision — locked Day 0: Option B (MVP with SNS).** `SQS → Lambda → DynamoDB → SNS`. SNS is mandatory (already in scope). No further vote needed; log confirmation row in `docs/architecture-decisions.md`.

---

## 7. Prathamesh
- [ ] Push Day 0 files via `p/day0-setup` (repo settings already created by Swapnil — verify protection).
- [ ] Coordinate budget alert proof; fill `docs/cost-log.md` (IDs/names only, no secrets).
- [ ] Verify `.gitignore`; review OpenCode instructions.
- Evidence: repo settings screenshot, budget screenshot, `git check-ignore` output, PR link.

## 8. Swapnil
- [ ] Create repo + add Prathamesh; set branch protection.
- [ ] Clone independently; verify own IAM console login in us-east-2.
- [ ] Review `AGENTS.md` + `OPENCODE.md`; create `app/ worker/ infra/ scripts/` + `.gitkeep` (already scaffolded — verify), PR `s/day0-skeleton`.
- Evidence: clone success, console login, PR link, repo tree screenshot.

---

## 9. Shared Documentation Checklist (headings + placeholders OK today)

```text
docs/
├── api-contracts.md        (frozen)
├── aws-scope.md            (single file: mandatory/deferred/doc-only)
├── architecture-decisions.md (incl. security + SNS lock row)
├── cost-log.md
├── contribution-log.md
├── deployment.md
├── destroy-checklist.md
├── day-0-setup.md          (this file)
├── day-1-network.md
├── architecture.md           (diagram stub — fill by demo day)
└── demo-script.md            (video plan stub — fill by demo day)
```
Do not invent implementation evidence before implementation. Never keep both `aws-services-used/not-used` or a separate `security-decisions.md` — merged already.

---

## 10. OpenCode Verification

Both run inside the repo (read-only):
```text
Read AGENTS.md, OPENCODE.md, duokart-context.md, duokart-project.md, docs/api-contracts.md and docs/aws-scope.md. Do not modify files. Summarize: 1. project purpose 2. mandatory services 3. deferred services 4. current API contract 5. Day 1 starting point.
```
Expected: reads instructions, modifies nothing, identifies architecture, flags unresolved items.

---

## 11. Definition of Done

- [ ] Both clone, branch, and open PRs; `main` protected, no squash.
- [ ] `.gitignore` blocks secrets; `.venv` uncommitted.
- [ ] Python + OpenCode work on both machines (no AWS CLI anywhere).
- [ ] Both IAM console logins pass in `us-east-2`; no access keys exist.
- [ ] Budget alerts configured + screenshot filed.
- [ ] Zero billable infra running (empty EC2/RDS/ALB screenshots).
- [ ] Scope + SNS decision logged; contracts reviewed; change process understood.
- [ ] OpenCode verification passes on both machines.

## Day 1 starting point
Custom VPC: CIDR plan → public/private subnets → route tables → IGW → 1 NAT → security-group baseline. See `docs/day-1-network.md`. No Day 0 item left open before starting.
