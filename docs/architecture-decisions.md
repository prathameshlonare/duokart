# Architecture decisions (single log — both sign, incl. security)

| Date | Decision | Reason | Signed |
|------|----------|--------|--------|
| 2026-09-14 | Region us-east-2 (Ohio) locked | Cheaper ALB/NAT/RDS than Mumbai; credits go further | p + s |
| 2026-09-14 | AWS: Swapnil's account, root + IAM `prathamesh` + `swapnil` | His credits expiring — use first, destroy fast | p + s |
| 2026-09-14 | Console-only, no CLI, no access keys | Simpler for 2-person capstone; keys never in git | p + s |
| 2026-09-14 | Repo owned by Swapnil, Prathamesh collaborator | Balances AWS ownership; PR-only `p/*` + `s/*`, no squash | p + s |
| 2026-09-14 | `docs/api-contracts.md` frozen | Prevents mid-week rewrite; changes need new row here + both approve | p + s |
| 2026-09-14 | Secrets: IAM roles + SSM Parameter Store, `.env` never committed | No keys in git ever | p + s |
| 2026-09-14 | S3 Object Lock on bills, versioning everywhere | Bills never lost/deleted by mistake | p + s |
| 2026-09-14 | SNS mandatory (Option B: SQS → Lambda → DynamoDB → SNS) | Buyer + owner notifications are core demo; SES deferred, SNS email is enough | p + s |
| 2026-09-14 | Route53 real domain deferred; alias-to-ALB design doc-only | No $12-13 purchase for a temp stack; ALB DNS used in demo | p + s |

| 2026-09-14 | Credit total corrected $130 → 170 credits (Billing → Credits) | Console shows 170; 3 docs said $130. Budget amount set to 170, alerts unchanged ($60 warn / $100 stop-and-destroy). Affected: `duokart-project.md`, `docs/day-0-setup.md`, `docs/cost-log.md` | s (Swapnil) — needs p sign in review |
| 2026-09-15 | Budget interim: `duokart-cap` $10 only, keep as-is for Day-0 | Reason: Day-0 runs zero billable infra (EC2/RDS/ALB empty in us-east-2, verified 2026-09-15), so $10 trips earlier and is safer while screenshots recycle. Impact — cost: earlier alert, no overspend risk; security: none; implementation: must raise to $170 with $60 warn / $100 stop-and-destroy before Day-1 NAT burn starts. Affected: `docs/cost-log.md`, `docs/screenshots/day-0/budget-cap.png`. Extra `My Monthly Cost Budget $5.00` left untouched — ignore, single source of truth stays `duokart-cap`. | p (Prathamesh) — needs s sign (billing owner) |

Add new rows for further change requests — never edit a signed row.
