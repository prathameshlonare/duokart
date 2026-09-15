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

| 2026-09-15 | Adopt RDS Multi-AZ (diagram wins over single-AZ lock) | Final `architecture.png` shows Primary + Standby with sync replication; team chose production-like DB. Impact — cost: ~2x DB burn, nightly deletes + destroy-after-demo mandatory; security: DB stays private, SG 3306 from app-sg only; implementation: `infra/03-data.yaml` builds MultiAZ DB, `docs/aws-scope.md` updated. Affected: `infra/03-data.yaml`, `docs/aws-scope.md`, `docs/cost-log.md` | s + p (Prathamesh verified 2026-09-16) |
| 2026-09-15 | Add Bastion EC2 (SSH) in public subnet | Diagram shows jump server; team kept it over SSM for SSH learning value. Impact — cost: +1 billable EC2, dies in nightly teardown; security: key pair via Console only (`*.pem` gitignored), SG 22 from admin IP only, never `0.0.0.0/0`; implementation: `bastion-sg` lives in `01-vpc.yaml`, instance in `02-alb.yaml`. Affected: `infra/01-vpc.yaml`, `infra/02-alb.yaml`, `docs/aws-scope.md` | s + p (Prathamesh verified 2026-09-16) |
| 2026-09-15 | Diagram: Route53 drawn dashed/doc-only, flow uses ALB DNS | Confirms 2026-09-14 deferral row for `architecture.png`: no purchase, no deploy. No cost/implementation impact. | s + p (agreed in review) |

| 2026-09-15 | VPC stack naming deviation: template `01-vpc.yaml` runs as `duokart-02-vpc` | First create (`duokart-01-vpc`) rolled back on illegal em-dash in bastion SG description; retry shell `duokart-02-vpc` is CREATE_COMPLETE. Convention locked: live Console names rule, docs follow reality; exports are `duokart-02-vpc-*` and Day-2 imports must use them. Dead `duokart-01-vpc` shell deleted 2026-09-16 (Prathamesh). Affected: `docs/day-1-network.md`, `docs/deployment.md`, `docs/destroy-checklist.md`, `AGENTS.md` nightly rule | s + p (Prathamesh verified 2026-09-16) |

Add new rows for further change requests — never edit a signed row.
