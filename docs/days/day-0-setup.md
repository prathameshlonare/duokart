# Day 0 — Project Bootstrapping and Readiness

## Objective

Prepare both contributors, the repository, dev environments, AWS account, architecture decisions, and docs system.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**No AWS application infrastructure on Day 0.** Do not create: EC2, ALB, ASG, RDS, NAT Gateway, Lambda, SQS, DynamoDB tables, production S3 buckets. Preparation only.

---

## 1. Together — Repository and Team Setup

### GitHub repository
- [x] Create the DuoKart repo (Swapnil owner — his AWS holds the expiring credits) + Prathamesh as collaborator.
- [x] Both can clone and push directly to `main` (branch protection removed per `NEW-WORKFLOW.md`).
- [x] Direct pushes to `main` are allowed — no PRs required.

### Initial push
- [x] Push all Day 0 files directly to `main`. Confirm present: README, `docs/api-contracts.md`, `docs/aws-scope.md`.

### Git security check
```bash
git check-ignore .env
git status
```
Expected: first command prints `.env`; second shows no credentials or private config.

---

## 2. Together — Local Development Environment

Both machines need: Git, Python 3.x + pip, VS Code (or preferred editor). No AWS CLI — console-only project.
```bash
git --version
python --version
pip --version
```

Python env inside repo (never commit `.venv`):
```bash
python -m venv .venv
```
Windows PowerShell: `.venv\Scripts\Activate.ps1`. Verify with `python --version` + `pip list`.

---

## 3. Together — AWS Account Preparation (Console, us-east-2)

- [x] Use only `us-east-2` (Ohio). Set region selector in Console; every CloudFormation stack later targets it.
- [x] Root MFA on (Swapnil's account). Root access keys must not exist. Never use root for daily work.
- [x] Create IAM users `prathamesh` + `swapnil`: console passwords only, no access keys, least privilege. No credential sharing.
- [x] Each contributor logs in to Console as own IAM user in us-east-2 — landing page loads = verified. Save account ID privately; never commit IDs or secrets.

---

## 4. Together — Budget and Cost Protection

Shared budget: 170 credits max (Swapnil's, expiring — destroy fast). Warn $60, stop-and-destroy $100.
- [x] Budget alerts at 60 + 100 to both emails (Console: Billing → Budgets).
- [x] No billable infra today. Idle rule going forward: if not demoing within 24h, delete ALB/RDS/NAT stacks.

---

## 5. Together — Freeze the Initial Architecture

Mandatory (see `docs/aws-scope.md`): IAM, VPC, EC2, ALB, ASG, RDS MySQL, S3, SQS, Lambda, DynamoDB, SNS (buyer + owner), SSM Parameter Store, CloudFormation, CloudWatch, CloudTrail, Budgets.

Deferred (doc-only, need both to approve): Route 53 real domain, ECS/Fargate/ECR, Beanstalk, Cognito, SES (SNS email is enough), WAF, ElastiCache, RDS Multi-AZ, S3 CRR, multi-NAT, Payment Gateway, CloudFront.

Architecture is approved for Day 1 but can change — discuss and agree before implementation.

---

## 6. Together — Resolve API Contract + Notification Decisions

Review `docs/api-contracts.md` and confirm:
- [x] `OrderCreated` payload final for MVP; `orderId` is the idempotency key.
- [x] Duplicate SQS delivery must not double-process; DynamoDB transitions forward-only.
- [x] Uploads use presigned URLs; app never proxies file bytes.

**Notification decision — locked Day 0: Option B (MVP with SNS).** `SQS → Lambda → DynamoDB → SNS`. SNS is mandatory (already in scope). No further vote needed.

---

## 7. Prathamesh
- [x] Push Day 0 files directly to `main`.
- [x] Verify `.gitignore`.
- Evidence: git check-ignore output, commit hash.

## 8. Swapnil
- [x] Create repo + add Prathamesh.
- [x] Clone independently; verify own IAM console login in us-east-2.
- [x] Create `app/ worker/ infra/ scripts/` + `.gitkeep` folders.
- Evidence: clone success, console login, commit hash.

---

## 9. OpenCode Verification

Both run inside the repo (read-only):
```text
Read docs/api-contracts.md and docs/aws-scope.md. Do not modify files. Summarize: 1. project purpose 2. mandatory services 3. deferred services 4. current API contract 5. Day 1 starting point.
```
Expected: reads instructions, modifies nothing, identifies architecture, flags unresolved items.

---

## 10. Definition of Done

- [x] Both clone and push directly to `main`.
- [x] `.gitignore` blocks secrets; `.venv` uncommitted.
- [x] Python works on both machines (no AWS CLI anywhere).
- [x] Both IAM console logins pass in `us-east-2`; no access keys exist.
- [x] Budget alerts configured.
- [x] Zero billable infra running.
- [x] Scope + SNS decision logged; contracts reviewed.
- [x] OpenCode verification passes on both machines.

## Day 1 starting point

Custom VPC: CIDR plan → public/private subnets → route tables → IGW → 1 NAT → security-group baseline. See `docs/day-1-network.md`. No Day 0 item left open before starting.
