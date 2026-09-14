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

Add new rows for Swapnil's change requests — never edit a signed row.
