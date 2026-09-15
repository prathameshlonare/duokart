# Cost log — 170 credits shared (Swapnil's account, expiring)

## Guardrails
- 1 NAT Gateway max. RDS Multi-AZ small (per 2026-09-15 diagram decision — top burner with ALB). Destroy ALB/RDS/NAT/bastion when idle.
- Alarms: $60 warn + $100 stop-and-destroy to both emails.
- Rule: templates stay, running machines don't. Rebuild for demo, destroy after.

## Proof (Day 0 — Swapnil, 2026-09-14; updated Prathamesh, 2026-09-15)
- [x] Credits: 170 (Swapnil's account, expiring) — verified Billing → Credits 2026-09-14
- [x] Budget `duokart-cap` ACTUAL Day-0: monthly fixed $10.00, status OK/Healthy, $0.00 actual / $0.08 forecast (2026-09-15) — screenshot `docs/screenshots/day-0/budget-cap.png`. Interim per `docs/architecture-decisions.md` 2026-09-15 row — canonical guardrail stays $170 with $60 warn / $100 stop-and-destroy, to be applied before Day-1 NAT.
- [x] Billing owner: Swapnil. Who presses destroy: Swapnil
- [x] Empty EC2/RDS/ALB consoles in us-east-2 (Prathamesh verified Ohio, no Account ID exposed — `docs/screenshots/day-0/ec2-empty.png`, `rds-empty.png`, `alb-empty.png`).
- [ ] TODO Day-1: raise `duokart-cap` to $170 + set $60 warn / $100 stop alerts to both emails; delete/ignore extra `My Monthly Cost Budget $5.00`

## Burn log (fill during build)
| Date | What ran | Cost signal | Destroyed? |
|------|----------|-------------|------------|
| | | | |
