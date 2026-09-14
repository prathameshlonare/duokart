# DuoKart — Project Context (living doc)

> Appended bit by bit from Prathamesh. Stops only when he says done.
## 1. Team + ownership
- Team of 2: Prathamesh + Swapnil.
- Work split 50/50 by real tasks, not just code review.
- Goal: both do hands-on infra + app work so each can claim real contribution on resume.

## 2. Lifecycle + GitHub-first end state
- AWS is temporary (build + test + demo only), GitHub is permanent.
- Flow: build -> test thoroughly -> screenshots/outputs -> push all source + docs to GitHub -> destroy AWS stacks -> zero bill.
- GitHub must stand alone: proper README, docs/, architecture diagram, demo proof.

## 3. Timeline + setup-first
- Build window: 1 week, 4 hrs/day, starting Sept 14, 2026.
- No direct build on day 1. Setup phase first: folder structure, .md docs, contracts.
- Then proper run: planning -> build -> test -> docs -> cleanup.

## 4. Execution mode (day-wise docs)
- Plan first, then setup GitHub, then day-wise build docs.
- Each day doc = per-person tasks with: what to build, how to build, what to document, how to document, when/how to push to GitHub.
- Both follow only the day doc. Tick off each phase/item/topic on completion.

## 5. Tooling (opencode)
- Primary build tool: opencode.
- Folder structure must be opencode-friendly (AGENTS.md, plan docs, skills-aware layout).

## 6. Runtime (suggested: Python)
- Python: FastAPI/Flask app + boto3 Lambda. Reason: Pune 2026 trainee roles skew Python+AWS, simpler Lambda packaging, easier for interviews.
- Change to Node only if both already know JS well.
- Decided: Python yes.

## 7. AWS account (decided: one shared, Swapnil's)
- One shared account (Swapnil's, credits expiring — destroy fast), two IAM users (prathamesh, swapnil) + MFA on root.
- Console-only: console passwords, no access keys, no AWS CLI.
- Need: budget cap + who presses destroy (decide before day 1).
- Decided: 170 credits in Swapnil's account. Guardrail: Budget 60 warn + 100 cutoff, 1 NAT only, destroy ALB/RDS when idle (full stack burns ~150/mo if left on). Region locked to us-east-2 (Ohio).

## 8. Repo (decided: new repo owned by Swapnil)
- New repo owned by Swapnil (his AWS holds credits), Prathamesh as collaborator from day 1. After done + cleanup, Prathamesh forks/mirrors so both have contribution history.
- Need: branch rule (main + `prathamesh/*`, `swapnil/*` or PR-only).
- Suggested (best for both resumes): one repo owned by Swapnil (his AWS holds credits), Prathamesh as collaborator from day 1. Branches `p/*` + `s/*`, PR-only into main, other person reviews. Keeps both in Insights -> Contributors + green squares. No squash (keeps authorship). Each resume links repo + lists own stacks owned.

## 9. Scope guardrails (resume-worthy in 1 week)
- Keep (non-negotiable for 2026 resume): custom VPC, ALB+ASG self-heal, RDS single-AZ, SQS->Lambda->DynamoDB->SNS, S3 versioning+lock+lifecycle, CloudFormation YAML, CloudWatch alarms, CloudTrail, Budgets. Route53: alias-to-ALB design doc-only, no domain purchase.
- Defer (document, don't build): Beanstalk alt, S3 CRR, multi-NAT, RDS Multi-AZ, WAF.
- Demo proof kept: order->mail video + kill-1-EC2 self-heal + load-test note.

## 10. Secrets (suggested)
- No keys in git ever. IAM roles for EC2/Lambda, SSM Parameter Store for DB password, `.env` in `.gitignore`.
