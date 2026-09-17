# Day 3 — Execution Plan in Simple Words (RDS Data Tier)

**Team:** Swapnil + Prathamesh (50/50 split, alternating commits to `main`)
**Region:** us-east-2 Ohio, Console only, no keys on laptops
**Stacks:** `duokart-02-vpc` (keep up) + `duokart-02-compute` (already live) + `duokart-03-data` (new today)
**Goal:** Shop app talks to a real private database, password kept in a locker, servers learn it automatically on restart.
**Time:** About 45-60 mins + 15-20 mins waiting for database to become ready.

---

## 1. The story in one minute

Think of DuoKart as a shop:

* Day 1 built the building (VPC) with public entry for customers and private back rooms.
* Day 2 opened two counters (EC2 servers) behind a main door man (ALB). Counters serve from memory only.
* Day 3 adds a back locker room (RDS MySQL) in the private back rooms, plus a combination locker (SSM Parameter Store) for the key.

Problem today: counters are already running but they do not know the locker room address or combo. We want them to learn it themselves every time they start, so morning rebuilds just work.

---

## 2. Why we need the password locker

If you write the database password directly in the template or app file:

* It goes into git history forever.
* AWS writes it in stack events and logs where anyone with console view can see it.

SSM Parameter Store SecureString fixes this:

* Password is encrypted and hidden in console.
* Only the app servers role is allowed to ask for it.
* You can change it later without changing code.
* Auditors can see who asked, when.

What we will do (recommended simple way):

* When creating the `duokart-03-data` stack, you paste a strong password once in the password box.
* CloudFormation puts that same value in two places: sets it as the database master password, and saves a copy in the locker at `/duokart/dev/db-password`.
* App never has the password in git. It asks the locker at boot time.

No passwords are committed. The temporary password lives only in your copy-paste and the locker.

---

## 3. What order and why

Correct order is: Database first, then update Compute. Do not do reverse.

Why:

1. Database only needs the building (VPC). It needs private room IDs and DB security group from `duokart-02-vpc`. Those already exist. So it can be built right now.
2. Counters update needs the database address. That address only exists after database is `Available`. So compute update must wait.
3. If you update compute first, you have nothing to point it to and the new servers will fail health checks.

So:

* Morning: confirm `duokart-02-vpc` and `duokart-02-compute` are `CREATE_COMPLETE`.
* Midday: build `duokart-03-data`, wait till RDS `Available`.
* Evening: update `duokart-02-compute` to auto-fetch, refresh servers, test.

Never delete VPC today. Nightly delete order (if needed): `03-data` first, then `02-compute`, VPC last.

---

## 4. The automatic workaround (no hand typing on servers)

Manual fix would be: login to each EC2 box, edit service file, restart. That works once but breaks next rebuild and breaks the rule that templates are truth.

Automatic fix we will use:

* Teach the server startup paper (Launch Template in `02-compute`) to fetch on its own.
* Give the server role permission to open only `/duokart/dev/*` locker items.
* On every boot, the new server asks: what is DB address, what is DB password, then starts the shop with those.
* Then replace old servers one by one with new ones (ASG Instance Refresh). Shoppers see no downtime because ALB keeps one counter live.

After this, every morning rebuild works the same: upload `03-data`, upload updated `02-compute`, servers self-connect.

You will also save the DB address itself in the locker as `/duokart/dev/db-endpoint` so servers need only one place to look.

---

## 5. Turn 1 — Swapnil: Build database + locker (about 50%)

**You do:** database subnet group + database instance + password locker + outputs.

Steps in console:

1. Pull latest `main`. Make sure `infra/01-vpc.yaml` and `infra/02-compute.yaml` are unchanged.
2. Create new file `infra/03-data.yaml` with:
   * Inputs: VPC stack name (default `duokart-02-vpc`), environment `dev`, DB password (hidden), DB name `duokart`.
   * Subnet group using Private Subnet 1 + Private Subnet 2 from VPC stack.
   * Database: name `duokart-dev-db`, MySQL 8.0, small size `db.t3.micro`, 20 GB, allow it to grow if needed, copy in second zone for safety (Multi-AZ), keep in private rooms only, not public, use DB security group from VPC stack (allows 3306 only from app servers), backup 7 days, no deletion protection and skip final snapshot so nightly delete is cheap.
   * Locker items: `/duokart/dev/db-password` (secret) and `/duokart/dev/db-endpoint` (address).
   * Outputs: endpoint, port 3306, DB name, locker name.
3. Check file is valid YAML locally (no AWS call).
4. Commit and push directly to `main`. Example message: `feat(day3): add RDS Multi-AZ + SSM password store`.
5. Console: CloudFormation -> Create stack -> Upload `infra/03-data.yaml` -> name `duokart-03-data` -> region Ohio -> paste strong password (make with password generator, 16+ chars) -> Create.
6. Wait. Subnet group 1 min, locker 30 sec, database 10-15 mins. Do not delete and retry, just watch Events tab.
7. Verify: stack `CREATE_COMPLETE`, RDS Databases `duokart-dev-db` is `Available`, Multi-AZ Yes, Publicly accessible No, SSM Parameter Store shows the locker item as SecureString.
8. Tell Prathamesh to pull.

Done when: stack complete + RDS available + locker exists. Take screenshots 1-4 (see section 7).

---

## 6. Turn 2 — Prathamesh: App + auto-connect + refresh (about 50%)

**You do:** shop app DB talk + server auto-fetch + refresh + test.

Steps:

1. Run pull to get Swapnil's database file.
2. Update shop app:
   * Add MySQL talk helpers to requirements (Flask stays, plus MySQL driver and its security helper).
   * App reads address, port, user, password, DB name from environment, defaults to localhost for laptop testing.
   * Home page returns live message as JSON.
   * Health page tries a quick DB hello: if ok returns healthy + connected, if fail returns sick with reason.
   * Products page reads all rows from products table, returns list (empty list is ok on first day).
   * Add a simple `schema.sql` with three tables if missing: products, users, orders (only id + few columns, enough for Day 3).
3. Update compute paper `infra/02-compute.yaml` for auto-connect:
   * Fix VPC stack default to `duokart-02-vpc` if still old.
   * Add new input for DB stack name default `duokart-03-data`.
   * Give EC2 role permission to read `/duokart/dev/*` locker items.
   * Change server startup to: fetch endpoint + password from locker at boot, save as service environment, then start shop. Keep existing Flask port 5000 and health path `/health`.
4. Test locally without AWS: run app with empty password -> health should say sick, that proves DB check works.
5. Commit and push directly to `main`. Can be 1 or 2 commits, example: `feat(day3): Flask RDS wiring + auto-fetch in compute template`.
6. Console: CloudFormation -> select `duokart-02-compute` -> Update stack -> Replace template with your updated file -> keep same params + add DB stack name -> Update.
7. Refresh servers: EC2 -> Auto Scaling Groups -> `duokart-dev-asg` -> Instance refresh -> Start. Wait till 2 new instances are healthy in Target Group (3-4 mins).
8. One-time table creation: use Session Manager to one new EC2 box, fetch locker values, run `schema.sql` once against RDS endpoint. Exit.
9. Test shop: open ALB DNS + `/health` should be 200 healthy, `/products` should be empty list or rows, not 502.
10. Take screenshot 5 and push screenshots folder to `main`.

Done when: ALB serves healthy with DB connected, products endpoint works, screenshots committed.

---

## 7. Proof photos to save in `docs/screenshots/day-3/`

1. `stack-complete.png` - CloudFormation `duokart-03-data` status complete.
2. `rds-details.png` - RDS Databases `duokart-dev-db` available, MySQL, micro, Multi-AZ.
3. `rds-connectivity.png` - Connectivity tab showing private VPC, port 3306, security group.
4. `ssm-parameter.png` - Parameter Store `/duokart/dev/db-password` type SecureString (value hidden).
5. `app-health-db.png` - Browser ALB DNS `/health` showing healthy + connected.

Push directly to `main`, no PR needed per repo rules.

---

## 8. If something breaks

* Database takes forever: normal, 10-15 mins for Multi-AZ. Check Events, do not recreate.
* App cannot reach DB: check DB security group allows 3306 only from app security group, check DB is in private subnets, check endpoint spelling, test port from EC2 box.
* Wrong password: check locker name exactly `/duokart/dev/db-password`, retype, restart service or refresh one instance.
* Targets unhealthy after compute update: check new startup logs on EC2, check app listens on 5000, check health path is `/health`.
* Old VPC name error: if template still defaults to `duokart-01-vpc`, change to `duokart-02-vpc` - live VPC kept that name after retry.

---

## 9. Cost and cleanup reminder

Running today adds the database (~0.84 per day) to existing ALB + servers + NAT. Total about 3 per day. Biggest burner is RDS + NAT.

Nightly: delete `duokart-03-data` first (5-10 mins for RDS), then `duokart-02-compute`, keep `duokart-02-vpc` up all week. Verify RDS 0, EC2 0, NAT still 1.

---

## 10. Definition of done for Day 3

* `infra/03-data.yaml` valid and on `main`.
* `duokart-03-data` is `CREATE_COMPLETE` in Ohio.
* RDS `Available`, private, Multi-AZ, correct security.
* Locker items exist and encrypted.
* App updated and on `main`, compute template updated for auto-fetch.
* ASG refreshed, ALB health 200 with DB connected.
* 5 screenshots committed.
* Both names in commit history.
