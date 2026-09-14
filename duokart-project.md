# DuoKart — Small Shop Order + Bill Manager

**Team:** Prathamesh + Swapnil, 50/50 real work split so both can claim it on resume.
**Stack:** Python (app + Lambda worker).
**AWS:** one shared account (170 credits, Swapnil's — expiring, destroy fast), us-east-2 (Ohio). Temporary — destroyed after demo. Console-only, no CLI.
**GitHub:** one new repo (Swapnil owner, Prathamesh collaborator), PR-only (`p/*` + `s/*`, mutual review). Prathamesh forks/mirrors after final tag.
**Time:** 1 week, 4 hrs/day from Sept 14, 2026. Setup-first: folders + docs before building.
**Tool:** opencode-friendly layout.

**Resume one-liner:** "Built event-driven shop app on AWS (ALB + Auto Scaling + RDS + SQS + Lambda + DynamoDB + SNS), full IaC in CloudFormation, custom VPC."

---

## The problem (simple words)

Small shops take orders on WhatsApp. Bills get lost. Photos get deleted. The site crashes during Diwali sale. DuoKart gives the shop one link: proper bills that never get lost, and a site that stays up when 500 people order at once.

## How a person uses it

Priya runs a tiffin + handmade soap shop in Pune. She puts her soaps on the site with photos and prices.

Rahul opens the site on his phone, adds 3 soaps to the basket, and places the order. He gets a bill on email plus a message: "order received, packing." Priya gets a message: "new order #42, 3 soaps, deliver to Kothrud."

If Rahul uploads a payment screenshot, it is saved safely and can't be deleted by mistake. If 200 people order during a festival offer at the same time, nobody sees an error — orders wait in a line and get confirmed one by one. Priya can see all orders, daily sales, and download any old bill anytime.

## What we build (plain words, service in brackets)

1. **Shop website** that can grow and heal itself — if one machine dies, a new one joins automatically (EC2 + Auto Scaling + Load Balancer).
2. **Shop database** for products, orders, users (RDS MySQL, single small machine to save cost).
3. **Photo + bill storage** that keeps old versions, moves old files to cheap storage, and locks bills so nobody can delete them (S3).
4. **Order line** — every order waits in a queue, a worker picks it up, saves the status, and sends messages to buyer + owner. No order lost even in a rush (SQS → Lambda → DynamoDB → SNS).
5. **Private network** we design ourselves — separate public/private areas, locked doors between them (custom VPC, subnets, gateways, security groups).
6. **Shop address + watchmen** — alias-to-ALB routing design (doc-only, no domain bought), alarms + dashboard for problems, audit trail of who changed what (Route 53 design + CloudWatch + CloudTrail).
7. **Everything as code** — the whole setup is written in template files in `infra/`, uploaded via Console (one upload builds, reverse-order delete destroys), so rebuild and teardown are repeatable (CloudFormation YAML).

Deferred to stay in 1 week (noted in README, not built): managed-app alternative, copy-to-second-region, extra gateways, multi-copy database, firewall. Documented as follow-ups.

## How we split it 50/50

- Day 0 (together): repo + folders + docs + IAM users + budget alarm.
- Network + accounts: one designs, other reviews, then swap.
- Mid-week: one owns website + database, other owns queue + worker + messages. Fixed order format agreed first.
- Swap-and-break: each tests the other's part (duplicate order, big upload, kill one machine).
- End (together): domain + dashboard + diagram + demo video + destroy + cost note.
- Each day has a day-wise doc: what to build, how, what to document, when to push. Follow only that doc, tick off on completion.

## GitHub proof (the permanent output)

- Architecture diagram (simple boxes + arrows).
- 60-sec video: place order → mail arrives → kill 1 machine → new machine joins.
- Screenshots: order page, bill mail, dashboard, locked-file denial.
- Cost note: what burned money (NAT + ALB + RDS), idle vs demo-day cost, destroy checklist.
- Contribution log: who owned which part (matches PR history).

## Cost guardrails (170 shared)

- 1 gateway only, small single database, stop/delete ALB + DB when not demoing.
- Budget alarms at $60 (warn) and $100 (stop work + destroy).
- Rule: templates stay, running machines don't. Rebuild for demo, destroy after.

---
Picked as Idea 1 from original 5-idea list (Sept 13, 2026). Others dropped on Sept 13 — team decision: maximum service coverage in one resume project.
