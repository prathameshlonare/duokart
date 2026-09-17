# Day 4 — Execution Plan in Simple Words (S3 Storage Tier)

**Team:** Swapnil + Prathamesh (50/50 split, alternating commits to `main`)
**Region:** us-east-2 Ohio, Console only, no keys on laptops
**Stacks:** `duokart-01-vpc` (kept up) + `duokart-02-compute` (rebuild morning) + `duokart-03-data` (rebuild morning) + `duokart-04-storage` (new today)
**Goal:** Shop can give temporary upload tickets so browsers put photos and bills straight into S3. Bills bucket is locked so proof cannot be deleted.
**Time:** About 30-45 mins + 15 mins morning rebuild. S3 deploys in 2-3 mins (fastest so far).

---

## 1. The story in one minute

Think of DuoKart as a shop:

* Day 1 built the building (VPC).
* Day 2 opened counters (EC2) behind main door (ALB).
* Day 3 added back locker room (RDS) with combo in locker (SSM).
* Day 4 adds two godowns outside the shop (S3): one open godown for product photos, one locked godown for bill copies.

Problem today: app servers should never touch file bytes (slow + unsafe). Instead they sign a 15-minute ticket (presigned URL). Customer browser uses that ticket to put the file directly in the right godown. Bills godown has a lock that even admin cannot break for 30 days.

---

## 2. Why presigned + why lock

If app takes files and then puts to S3 itself:

* Big photos block the small counters (slow).
* App needs full S3 keys and becomes a target.
* Bills can be deleted or replaced later — no proof.

Presigned fixes this:

* App only signs a ticket using its IAM role, never sees bytes.
* Ticket expires in 15 mins, points to exact bucket + key.
* Browser uploads direct, S3 replies 200.

Lock fixes proof:

* Bills bucket created with Object Lock on (cannot be added later).
* Compliance mode 30 days means nobody, not even you, can delete early. Good for demo, painful for nightly delete — see section 8.
* Photos bucket has no lock (you can re-upload product shots).

No keys on laptops. Servers use IAM role to sign tickets.

---

## 3. What order and why

Correct order is: Rebuild first, then Storage. Do not build storage on empty foundation.

Why:

1. Storage template needs nothing from VPC, but app test needs ALB + RDS live. Presigned test goes via `http://<ALB-DNS>/uploads/url`, and that ALB only lives if `02-compute` is up.
2. Compute update for S3 needs bucket names. Those only exist after `04-storage` Outputs. So compute update must wait.
3. If you build storage first, you cannot test tickets end-to-end.

So:

* Morning: confirm `duokart-01-vpc` is `CREATE_COMPLETE` (kept overnight).
* Re-upload `02-compute` as `duokart-02-compute`, wait, check ALB live.
* Re-upload `03-data` as `duokart-03-data` with fresh DB password (old locker deleted last night), wait RDS `Available`, refresh ASG, check `/health connected` + `/products Neem Soap`.
* Midday: build `04-storage`, then update compute for S3, refresh, test tickets.

Swapnil can write `04-storage.yaml` locally while you rebuild — parallel paper work, sequential deploys.

---

## 4. Turn 1 — Swapnil: Build godowns + outputs (about 50%)

**You do:** photos bucket + bills locked bucket + SSM names + outputs.

Steps in console:

1. Pull latest `main`. Make sure `01-vpc`, `02-compute`, `03-data` files are as last night.
2. Create new file `infra/04-storage.yaml` with:
   * Inputs: `EnvironmentName` dev, `PhotosBucketName` (default `duokart-dev-photos-ps-18`), `BillsBucketName` (default `duokart-dev-bills-ps-18`). Use your suffix — must be globally unique. If `BucketAlreadyExists`, you will retry with new suffix, so keep it as param, not hardcoded.
   * Photos bucket: versioning on, public all blocked, encryption on, lifecycle to cheap storage after 30 days, CORS allow PUT/POST for browser, tags.
   * Bills bucket: same plus ObjectLockEnabled true on create, ObjectLock Compliance 30 days (dev decision: if you want easy nightly delete, use 1 day or Governance — decide together before Create, see section 8).
   * Two SSM String params: `/duokart/dev/s3-photos` = photos name, `/duokart/dev/s3-bills` = bills name (same pattern as DB endpoint — servers fetch at boot, no hardcode).
   * Outputs: `PhotosBucketName`, `PhotosBucketArn`, `BillsBucketName`, `BillsBucketArn`, `PhotosSSMName`, `BillsSSMName`.
3. Check file locally: `python -c` with CFN `!` ignore must print `YAML OK`.
4. Commit and push directly to `main`. Example: `feat(day4): add S3 photos + locked bills buckets`.
5. Console: CloudFormation → Create stack → Upload `infra/04-storage.yaml` → name `duokart-04-storage` → Ohio → fill bucket names with your suffix → Create.
6. Wait 2-3 mins. Photos ~30 sec, bills ~1 min.
7. Verify: stack `CREATE_COMPLETE`, S3 console shows both buckets in `us-east-2`, photos versioning on, bills lock enabled.
8. Tell Prathamesh to pull.

Done when: stack complete + both buckets visible + SSM names exist. Take screenshots 1-3.

---

## 5. Turn 2 — Prathamesh: Tickets + auto-wire + test (about 50%)

**You do:** presigned endpoint + server S3 rights + refresh + ticket test.

Steps:

1. Pull Swapnil's storage file.
2. Update shop app:
   * Add `boto3` to `app/requirements.txt` (Flask stays, `pip install -r` on servers picks it up).
   * Add `POST /uploads/url` in `app/app.py`: reads `{"kind":"photo|bill","filename":"..."}`, picks bucket from env `S3_PHOTOS_BUCKET` or `S3_BILLS_BUCKET`, makes key `photos/<filename>` or `bills/<filename>`, signs 15-min PUT ticket with `boto3`, returns `{"uploadUrl":..., "key":...}`. Bad kind → 400.
   * Keep `/`, `/health`, `/products` as Day 3 — do not break them.
3. Update compute paper `infra/02-compute.yaml` for auto-fetch:
   * Add param `StorageStackName` default `duokart-04-storage`.
   * To existing `Ec2InstanceRole` inline policies, add S3 rights: `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` on photos + bills ARNs only (import via `${StorageStackName}-PhotosBucketArn` etc., plus `/*` for objects). Least privilege, not `s3:*`.
   * In UserData boot: after DB fetch lines, add `S3_PHOTOS_BUCKET=$(aws ssm get-parameter ... /duokart/dev/s3-photos ...)` + same for bills + `AWS_REGION=us-east-2`, write as `Environment=` into `duokart.service`. Keep DB lines untouched.
4. Test locally without AWS: `POST /uploads/url` with fake env should return URL shape or clear error, bad kind → 400. Do not need real S3 for syntax check.
5. Commit and push directly to `main`. Example: `feat(day4): presigned uploads + S3 auto-fetch`.
6. Console: CloudFormation → `duokart-02-compute` → Update → Direct update → Replace template → params `VpcStackName=duokart-01-vpc`, `DbStackName=duokart-03-data`, `StorageStackName=duokart-04-storage` → Update → wait `UPDATE_COMPLETE`.
7. Refresh servers: ASG → Instance refresh (or terminate one-by-one like Day 3), wait 2x `healthy` in Target Group.
8. Live ticket test: `POST http://<ALB-DNS>/uploads/url {"kind":"photo","filename":"test.txt"}` → copy `uploadUrl` → `curl -X PUT --data-binary @test.txt "<uploadUrl>"` → 200 → S3 console shows object. Repeat for `bill`. Bad kind → 400.
9. Take screenshots 4-5 and push screenshots folder.

Done when: ALB ticket endpoint works for both kinds, objects land in correct buckets, old endpoints still green.

---

## 6. If something breaks

* Bucket name taken: normal, S3 global. Pick new suffix (`-ps2`, `-pr2`), update params, recreate. Never fight for a name.
* Lock cannot enable: you forgot `ObjectLockEnabled: true` on create or tried to add later. Bills must be recreated (empty versions first). No in-place fix.
* Presigned PUT 403: role missing `PutObject` on that bucket, bucket name mismatch, or URL older than 15 mins. Check role covers `bucket/*`, env matches Outputs, make fresh ticket and PUT within 5 mins.
* CORS browser error: bucket CORS missing PUT/POST. S3 → Permissions → CORS → allow `*`, methods `GET,PUT,POST`.
* Bills cannot empty for teardown: Compliance blocks delete till retention ends. For dev use 1-day retention or Governance mode (allows admin delete). Decide before deploy — Compliance 30d is demo-nice but nightly-painful.
* YAML `!GetAtt` error on local check: use CFN-ignore loader (same as Day 3 Step 9), not plain `safe_load`.

---

## 7. Proof photos to save in `docs/screenshots/day-4/`

1. `stack-complete.png` — `duokart-04-storage` = `CREATE_COMPLETE`
2. `s3-photos.png` — photos Properties: versioning Enabled + lifecycle + public blocked
3. `s3-bills-lock.png` — bills Properties: Object Lock Enabled + Compliance retention
4. `presigned-url.png` — POST `/uploads/url` JSON with `uploadUrl` + `key`
5. `s3-object.png` — bucket object list showing uploaded `photos/test.txt` (and `bills/...`)

Push directly to `main`.

---

## 8. Cost and cleanup reminder

S3 adds ~zero for demo (cents per GB + pennies per 1000 requests). Day 4 total still ~$3.01/day (RDS + NAT + ALB + EC2).

Nightly: empty photos (all versions) → empty bills (if Compliance blocks, you chose wrong retention — use Governance/1-day for dev) → delete `04-storage` → delete `03-data` (5-10 mins RDS) → delete `02-compute` → keep `01-vpc`. Verify S3 0 with suffix, RDS 0, EC2 0.

---

## 9. Definition of done for Day 4

* `infra/04-storage.yaml` valid and on `main`
* `duokart-04-storage` is `CREATE_COMPLETE` in Ohio
* Photos versioning + lifecycle on, public blocked
* Bills lock enabled + retention as decided
* App `POST /uploads/url` works for photo + bill, 400 on bad kind
* PUT to ticket lands in correct bucket
* Day 3 endpoints still green (`/health connected`, `/products Neem Soap`)
* 5 screenshots committed
* Both names in commit history
