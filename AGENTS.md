# DuoKart Agent Rules

These rules apply to OpenCode, all AI agents, and both human contributors.

## 1. Project Identity

* Project: DuoKart
* Type: AWS-based small-shop order and billing manager
* Team: Prathamesh + Swapnil
* Contribution model: 50/50 genuine implementation
* Primary goal: Build, understand, document, test, and explain every implemented component.
* AWS account: Swapnil's (credits expiring — destroy fast). Root + 2 IAM users (`prathamesh`, `swapnil`), console passwords only, no access keys.
* AWS region: `us-east-2` (Ohio) only.
* AWS mode: Console-only. No AWS CLI, no `aws` commands.
* Development style: Localhost-first (`AWS_MODE=local`), AWS resources only when required for testing or deployment.

---

## 2. Non-Negotiable Technical Rules

### Language and Framework

* Python only for backend development.
* Use Flask or FastAPI.
* Use `boto3` for AWS integrations.
* No Node.js backend.
* No unnecessary frontend framework changes without agreement from both contributors.

### Infrastructure

* Use CloudFormation YAML for AWS infrastructure.
* All infrastructure changes must be made through files in `infra/`.
* Deploy templates via Console upload (Create stack → Upload template). No CLI deploy.
* No manual console-click design of infrastructure — templates stay source of truth.
* Number CloudFormation templates according to deployment order.
* Every deployed resource must have a clear purpose in the project.

### AWS Region and Cost

* Use `us-east-2` only.
* Maximum one NAT Gateway.
* RDS must remain single-AZ and small-sized unless both contributors explicitly approve a change.
* Destroy idle ALB, EC2, ASG, RDS, NAT Gateway, and other billable resources.
* Nightly rule (consecutive build days): keep the VPC stack (live: `duokart-02-vpc`, incl. NAT, ~$1/day) up all week; delete stacks built from `02`–`05` templates at each day end once they exist and rebuild next morning via Console (~15 min). Never resolve numbers by parsing a stack name — the Console stack list is source of truth. Demo-eve and demo day are exempt — leave everything up, destroy right after filming per `docs/destroy-checklist.md`. Log every destroy/rebuild in `docs/cost-log.md`.
* Never create duplicate resources because of confusion or failed deployments.
* Before adding a new AWS service, check cost, purpose, and whether it is already represented by another service.

### Security

* Never commit AWS access keys, secret keys, passwords, tokens, or private keys.
* Never place secrets in source code.
* Never commit `.env` files.
* Use IAM roles for EC2 and Lambda.
* Use SSM Parameter Store for database credentials or runtime configuration.
* Follow least privilege.
* Do not weaken security groups just to make testing easier.

---

## 3. Mandatory AWS Services

The initial implementation scope includes:

1. IAM
2. VPC
3. EC2
4. Application Load Balancer
5. Auto Scaling Group
6. Amazon RDS MySQL
7. Amazon S3
8. Amazon SQS
9. AWS Lambda
10. Amazon DynamoDB
11. Amazon SNS (buyer + owner notifications)
12. SSM Parameter Store (DB credentials)
13. CloudFormation
14. CloudWatch
15. CloudTrail
16. Budgets (60 warn / 100 stop-and-destroy)

No additional AWS service becomes mandatory without a documented decision.

---

## 4. Deferred or Optional AWS Services

The following are not part of the initial implementation unless both contributors approve:

* Route 53 (real domain — doc-only alias design, no purchase)
* ECS
* Fargate
* ECR
* Elastic Beanstalk
* Cognito
* SES (SNS email is enough)
* WAF
* ElastiCache
* RDS Multi-AZ
* S3 Cross-Region Replication
* Multiple NAT Gateways
* Payment Gateway
* CloudFront

These services may be referenced in documentation as future improvements.

---

## 5. Local Development Rules

* Frontend and backend must work locally before AWS deployment.
* Default `AWS_MODE=local` (SQLite + `./uploads` + in-memory queue). `AWS_MODE=aws` only for demo.
* Use a Python virtual environment.
* Keep local configuration in `.env`.
* Never commit `.env`.
* Provide `.env.example` with placeholder values only.
* Test APIs locally before connecting them to AWS.
* Prefer local mocks or AWS service emulators when practical, but do not replace real AWS validation where the project requires it.

---

## 6. Git Rules

* `main` is protected.
* No direct pushes to `main`.
* Every change must use a pull request.
* Branch naming:
  * `p/*` for Prathamesh
  * `s/*` for Swapnil
* The other contributor must review the pull request.
* Do not squash commits.
* Keep commits small and meaningful.
* Do not commit generated files, credentials, logs, or build artifacts.

### Commit format

Use:

```text
type(scope): description
```

Examples:

```text
feat(app): add order creation endpoint
infra(vpc): add public and private subnets
docs(day-0): record environment setup
fix(worker): prevent duplicate order processing
```

---

## 7. AI Agent Rules

Before changing code, OpenCode must:

1. Read `AGENTS.md`.
2. Read `duokart-context.md`.
3. Read `duokart-project.md`.
4. Read the current `docs/day-*.md` file.
5. Check `docs/api-contracts.md` and `docs/aws-scope.md`.
6. Inspect existing files before creating new ones.

OpenCode must not:

* Invent AWS services.
* Change architecture silently.
* Modify API contracts without documenting the change.
* Design infrastructure by manual console clicks instead of CloudFormation templates.
* Add dependencies without explaining why.
* Delete working code without approval.
* Refactor unrelated files.
* Claim a task is complete without evidence.

### Role boundary (docs-only)

OpenCode may create or edit **`.md` files only**. It must never create or edit code (`.py`), infrastructure (`.yaml`/`.yml`), environment files (`.env`), or scripts (`.sh`/`.ps1`). Both contributors write all code and templates by hand — that is the learning.

On non-md files OpenCode is reviewer and guide only: read the human's code, explain what is wrong and why, and give fix instructions with corrected snippets in chat. It does not apply the fix. Read-only checks (`git status`, `pytest` output review, `cfn-lint`, reading console screenshots) are always allowed.

---

## 8. Change Management

If either contributor wants to change the architecture:

1. Stop implementation of the affected feature.
2. Record the proposed change in `docs/architecture-decisions.md`.
3. Explain the reason, impact, cost, and affected files.
4. Both contributors review the decision.
5. Update architecture, API contracts, AGENTS.md, and day documents if required.
6. Only then implement the change.

Architecture is flexible, but changes must be deliberate.

---

## 9. Documentation Rules

Every completed task must update the relevant documentation.

For each AWS service, document:

* Purpose
* Configuration
* CloudFormation resource
* Security considerations
* Cost considerations
* Testing evidence
* Contributor responsible
* Screenshot or log reference where applicable

Follow only the current `docs/day-*.md` file for daily work.

Tick off tasks as they are completed.

### Thoroughness standard (day docs and all generated files)

Every generated day doc or project file must be detailed enough that the other contributor can execute it with zero guesswork. Skim-level bullets are not acceptable.

Each day doc must contain: objective, prerequisites, per-person task tables (what / how with exact commands or console paths / what to document / when to push), verification steps with expected outputs, evidence required (screenshots, logs, PR links), cost impact, and a definition-of-done checklist.

Every generated file must contain: purpose, full working content (no `... fill later` stubs except explicitly-marked evidence placeholders), how to run/verify it, and how it connects to neighboring files. If a detail is unknown, write the open question plus who resolves it by when — never silently omit it.

---

## 10. Definition of Done

A task is complete only when:

* Code or infrastructure exists.
* It has been tested.
* The result is documented.
* The other contributor can understand it.
* Git changes are committed.
* A pull request is created.
* Review is completed.
* No unnecessary AWS resources remain running.

Be direct. Flag cost, security, architecture, or scope risks before implementation.
