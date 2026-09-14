# Cost log — 170 credits shared (Swapnil's account, expiring)

## Guardrails
- 1 NAT Gateway max. RDS single-AZ small. Destroy ALB/RDS/NAT when idle.
- Alarms: $60 warn + $100 stop-and-destroy to both emails.
- Rule: templates stay, running machines don't. Rebuild for demo, destroy after.

## Proof (Day 0 — Swapnil, 2026-09-14)
- [x] Credits: 170 (Swapnil's account, expiring) — verified Billing → Credits 2026-09-14
- [x] Budget `duokart-cap`: monthly fixed $170, alerts $60 warn + $100 stop-and-destroy (actual spend) to both emails — screenshot attached in PR
- [x] Billing owner: Swapnil. Who presses destroy: Swapnil
- [ ] Empty EC2/RDS/ALB consoles in us-east-2 (screenshots attached in PR)

## Burn log (fill during build)
| Date | What ran | Cost signal | Destroyed? |
|------|----------|-------------|------------|
| | | | |
