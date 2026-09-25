# DuoKart Workflow - Pair Programming + Cost Discipline

How Prathamesh + Swapnil share one keyboard over Discord, prove a real 50/50 split in `main` history, and keep AWS spend inside a student budget.

## 1. The Handoff Rule (the 50/50 proof)

One person streams and types, the other reviews live - never one streaming while the other watches. Both names must alternate in `main` history, because that history is the resume: on fork, each author's commits travel as contribution proof.

* **Turn 1 (Swapnil):** shares screen, builds one component, tests it, `git commit` + `git push origin main`.
* **The Handoff:** Prathamesh runs `git pull origin main` and confirms the diff.
* **Turn 2 (Prathamesh):** shares screen, builds the next component, tests it, `git commit` + `git push origin main`.
* **Repeat.** A real night looks like: bastion host (Swapnil) → ASG to private subnets (Prathamesh) → queue mail split (Prathamesh) → observe gaps (Swapnil).

A turn is one component + its verification, not one evening. Small alternating commits beat two giant ones - reviewers read the alternation as collaboration.

## 2. Commit subjects

Subject = what changed, imperative, file-scoped. Reasoning lives in day docs, never in subjects.

| Prefix | Use for | Example |
|---|---|---|
| `fix(...)` | Bug against intended design | `fix(compute): place ASG in private subnets` |
| `feat(...)` | New capability | `feat(queue): owner gets RECEIVED, buyer gets PACKING` |
| `docs(...)` | Prose, diagrams, plans | `docs(workflow): rename NEW-WORKFLOW to WORKFLOW` |

Scope in brackets names the tier (`vpc`, `compute`, `data`, `storage`, `queue`, `observe`). Never `git add .` - local-only plans and keys must not ride along.

## 3. Repo rules

* Direct pushes to `main` - no PRs required (owner disabled "require a pull request" under Settings → Branches).
* AWS is temporary, the repo is permanent. Console-only deploys, no CLI keys.
* `.pem` and `.env` never enter git. Ever.

## 4. Stack routine (us-east-2)

**Build order** - every import must exist before its consumer:

```
01-vpc → 03-data + 04-storage + 05-queue (parallel) → 02-compute → 06-observe
```

**Values you always paste** (keep this open during deploys):

| Stack | Parameter | Value pattern |
|---|---|---|
| `01-vpc` | `AdminSshCidr` | Your current IP + `/32` (bare IP fails the stack) |
| `03-data` | `DBPassword` | 16+ chars, only `A-Z a-z 0-9 - _ ! #` (`%` breaks systemd) |
| `06-observe` | `AlbShortName` | `app/<name>/<id>` tail of the ALB ARN |
| `06-observe` | `TgShortName` | `targetgroup/<name>/<id>` tail of the TG ARN |

**Nightly teardown** (reverse, VPC last): delete `02-compute + 05-queue + 03-data`, keep `01-vpc + 04-storage (ps-19)`. Confirm EC2 + NAT are gone so billing stops.

**Money:** ~\$3.01/day when up (RDS Multi-AZ + ALB + NAT are the burners), ~\$20–25 total on a Free Tier account for the whole build, guarded by a \$20 budget alarm.

