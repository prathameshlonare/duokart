# Day 4 — Storage Tier (S3 Photos + Bills)

## Objective

Deploy two S3 buckets for DuoKart uploads: photos (product images) and bills (payment screenshots). App generates presigned URLs so browsers upload direct to S3. Bills bucket is locked with Object Lock compliance mode.

**Region: `us-east-2` (Ohio). Console-only — no AWS CLI, no access keys.**
**Requires Day 1 VPC stack (`duokart-01-vpc`), Day 2 compute (`duokart-02-compute`), Day 3 data (`duokart-03-data`) to be running. VPC is kept up all week, compute + data are rebuilt each morning.**

---

## Prerequisites

- [x] VPC stack `duokart-01-vpc` is `CREATE_COMPLETE`
- [x] Compute stack `duokart-02-compute` is `CREATE_COMPLETE` (with Day 3 auto-fetch UserData)
- [x] Data stack `duokart-03-data` is `CREATE_COMPLETE`, RDS `Available`
- [x] Both contributors logged into AWS Console in `us-east-2`
- [x] Morning rebuild done (~15 mins): re-upload `02-compute`, then `03-data` with fresh DB password, refresh ASG, check `/health` returns `connected`

---

## 1. Together — Write the Storage Template

Create `infra/04-storage.yaml` with the following resources:

### Resources to Build

| Resource | Purpose | Key Config |
|----------|---------|------------|
| S3 Photos Bucket | Product photos | Versioning on, lifecycle to cheap storage, no public |
| S3 Bills Bucket | Payment screenshots | Versioning on + Object Lock compliance, lifecycle, no public |
| Outputs | Export bucket names + ARNs | For app env vars + IAM policy |

### Key Configuration Details

**Bucket names must be globally unique.** S3 names are shared worldwide. Do not use bare `duokart-photos`. Use:

- Photos: `duokart-dev-photos-<suffix>` (suffix = your initials + date, e.g. `duokart-dev-photos-ps-17`)
- Bills: `duokart-dev-bills-<suffix>`

Pass them as parameters `PhotosBucketName` and `BillsBucketName` so you never hardcode. If Create fails with `BucketAlreadyExists`, pick a new suffix and retry — this is the most common Day 4 error.

**Photos bucket:**
- Versioning: Enabled
- Public access: all blocked (BlockPublicAcls + BlockPublicPolicy + IgnorePublicAcls + RestrictPublicBuckets = true)
- Encryption: SSE-S3 (AES256)
- Lifecycle: transition current version to Intelligent-Tiering or Standard-IA after 30 days, expire noncurrent versions after 30 days
- CORS: allow PUT/POST from any origin for browser direct upload (allow headers `*`, methods `GET,PUT,POST`, max age 3000)
- Tags: Project DuoKart, Environment dev

**Bills bucket:**
- Same as photos, plus:
- ObjectLockEnabled: true at bucket creation (cannot be added later — must be set on create)
- ObjectLockConfiguration: Compliance mode, default retention 30 days (payment proof kept, not even admin can delete early)
- Versioning must be Enabled (required for Object Lock)
- Same lifecycle + encryption + public block + CORS

**Outputs:**
- `PhotosBucketName`, `PhotosBucketArn`
- `BillsBucketName`, `BillsBucketArn`

### Verify Template Locally (no AWS calls)
```bash
python -c "import yaml; yaml.SafeLoader.add_multi_constructor('!', lambda l,s,n: None); yaml.safe_load(open('infra/04-storage.yaml')); print('YAML OK')"
```

---

## 2. Handoff Rule

Follow the pair programming handoff from `NEW-WORKFLOW.md`:

**Turn 1 (Swapnil):**
- Build Photos bucket + Bills bucket (with Object Lock) + Outputs
- Test and push directly to `main`

**Turn 2 (Prathamesh):**
- Pull from `main`
- Build app `POST /uploads/url` presigned flow + EC2 IAM S3 policy + UserData bucket env vars
- Test and push directly to `main`

**Result:** Both names appear in commit history with alternating commits.

---

## 3. Deploy via Console

### Steps
1. Open AWS Console → CloudFormation → Create stack → Upload a template file
2. Choose `infra/04-storage.yaml`
3. Region: `us-east-2` (Ohio)
4. Stack name: `duokart-04-storage`
5. Parameters:
   - `EnvironmentName`: `dev` (default)
   - `PhotosBucketName`: `duokart-dev-photos-<your-suffix>`
   - `BillsBucketName`: `duokart-dev-bills-<your-suffix>`
6. Acknowledge IAM (no IAM resources, but tick if asked) → Create stack → wait for `CREATE_COMPLETE`

### What to Watch For
- S3 bucket creation: ~30 seconds each
- Bills bucket with Object Lock takes ~1 minute (versioning + lock handshake)
- Total deploy time: ~2-3 minutes (fastest stack so far)
- If `BucketAlreadyExists`: delete attempt, pick new suffix, recreate. Do not reuse someone else's bucket name.

---

## 4. Verify the Deployment

### CloudFormation Verification
- [x] Stack Status = `CREATE_COMPLETE` (no `ROLLBACK` events)
- [x] Outputs tab shows:
  - `PhotosBucketName` + `PhotosBucketArn`
  - `BillsBucketName` + `BillsBucketArn`

### S3 Console Verification
- [x] S3 → Buckets → photos bucket exists, Region `us-east-2`
- [x] Photos → Properties → Versioning = Enabled
- [x] Photos → Permissions → Block public access = On (all 4 on)
- [x] Photos → Properties → Lifecycle rules exist
- [x] S3 → Bills bucket exists
- [x] Bills → Properties → Versioning = Enabled
- [x] Bills → no Object Lock (`ps-19` dev decision: `DeletionPolicy: Delete` — Compliance lock dropped for nightly cleanup, `8148bde`; old `ps-18` locked bucket left as orphan)
- [x] Bills → Permissions → Block public access = On

### App Presigned Test
- [x] `POST http://<ALB-DNS>/uploads/url` with `{"kind":"photo","filename":"test.txt"}` returns 200 with `uploadUrl` + `key`
- [x] `curl -X PUT --data-binary @test.txt "<uploadUrl>"` returns 200
- [x] S3 console shows object under `photos/test.txt` (or `key` returned)
- [x] Same test with `{"kind":"bill",...}` lands in bills bucket
- [x] `{"kind":"bad"}` returns 400

---

## 5. Update Flask App for Presigned URLs

### How it works (simple words)
App never touches file bytes. Browser asks app "where do I put this photo?", app signs a temporary upload ticket (presigned URL valid ~15 mins), browser uploads straight to S3. Bills tickets point to locked bucket.

### Add to `app/app.py`

```python
import os
import boto3
from flask import request

S3_PHOTOS_BUCKET = os.environ.get('S3_PHOTOS_BUCKET', '')
S3_BILLS_BUCKET = os.environ.get('S3_BILLS_BUCKET', '')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-2')

s3 = boto3.client('s3', region_name=AWS_REGION)

@app.route('/uploads/url', methods=['POST'])
def get_upload_url():
    data = request.get_json(force=True, silent=True) or {}
    kind = data.get('kind')
    filename = data.get('filename', 'upload.bin')
    if kind not in ('photo', 'bill'):
        return jsonify({"error": "BAD_KIND", "message": "kind must be photo or bill"}), 400
    bucket = S3_PHOTOS_BUCKET if kind == 'photo' else S3_BILLS_BUCKET
    key = f"{'photos' if kind == 'photo' else 'bills'}/{filename}"
    url = s3.generate_presigned_url(
        'put_object',
        Params={'Bucket': bucket, 'Key': key, 'ContentType': 'application/octet-stream'},
        ExpiresIn=900
    )
    return jsonify({"uploadUrl": url, "key": key})
```

### Add to `app/requirements.txt`
```
boto3
```

### EC2 IAM + User-Data (update `infra/02-compute.yaml`)
- Add to `Ec2InstanceRole` inline policy (alongside existing `FetchDbCreds`):
  - Allow `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` on photos + bills bucket ARNs only (import via `DbStackName`? No — add new param `StorageStackName` default `duokart-04-storage`, import `${StorageStackName}-PhotosBucketArn` etc. Or use wildcard `arn:aws:s3:::duokart-dev-*` for Day 4 simplicity).
- Add to UserData systemd Environment:
  - `S3_PHOTOS_BUCKET` (from SSM or import), `S3_BILLS_BUCKET`, `AWS_REGION=us-east-2`
  - Simplest Day 4: fetch bucket names from SSM (store them as SSM String params in `04-storage.yaml` like you did for DB endpoint) at boot, same pattern as DB.
- `pip install -r app/requirements.txt` already picks up `boto3`, no extra server work.

**Alternative (manual, not recommended):** hardcode bucket names in UserData env. Breaks on suffix change, avoid.

---

## 6. Troubleshooting

### Issue: BucketAlreadyExists / BucketAlreadyOwnedByYou
**Root cause:** S3 names are global. Someone else owns that name.
**Solution:** Pick a new suffix (`-ps2`, `-swapnil2`), update params, recreate. Never try to reuse.

### Issue: Object Lock cannot be enabled
**Root cause:** Tried to add Object Lock to existing bucket or forgot `ObjectLockEnabled: true` on create.
**Solution:** Bills bucket must be created with lock on. If missed, delete bills bucket (empty it first, including versions) and recreate from template. No in-place fix.

### Issue: Presigned URL 403 on PUT
**Root cause:** EC2 role lacks `s3:PutObject` on that bucket, or bucket name mismatch, or URL expired (>15 mins).
**Solution:** Check role policy covers both bucket ARNs + `/*` objects, check env bucket names match Outputs, generate fresh URL and PUT within 5 mins.

### Issue: CORS error in browser
**Root cause:** Bucket CORS not allowing browser origin/method.
**Solution:** S3 → bucket → Permissions → CORS → allow `GET,PUT,POST`, headers `*`, origins `*` for Day 4 dev. Tighten to ALB DNS later.

### Issue: Bills object deletable (lock not working)
**Root cause:** Uploaded without retention or bucket lock not enabled.
**Solution:** Verify Properties → Object Lock Enabled. Check object → Object Lock → Compliance retention present. If not, template lock config is wrong — fix and recreate bills bucket.

---

## 7. Evidence Required

Screenshot and commit directly to `main`:

| # | What | Where to Find | Filename |
|---|------|---------------|----------|
| 1 | Stack complete | CloudFormation → duokart-04-storage → stack info | `stack-complete.png` |
| 2 | Photos bucket props | S3 → photos → Properties (versioning + lifecycle) | `s3-photos.png` |
| 3 | Bills lock | S3 → bills → Properties (Object Lock enabled) | `s3-bills-lock.png` |
| 4 | Presigned JSON | POST /uploads/url response | `presigned-url.png` |
| 5 | Object in bucket | S3 → bucket → object list showing uploaded key | `s3-object.png` |

Save to `docs/screenshots/day-4/` and push directly to `main`.

---

## 8. Cost Impact

| Resource | Cost | Notes |
|----------|------|-------|
| S3 storage (photos + bills, few MB) | ~$0.00/day | Cents per GB, negligible for demo |
| S3 PUT/GET requests | ~$0.00/day | Pennies per 1000 |
| RDS `db.t3.micro` Multi-AZ | ~$0.84/day | From Day 3, kept running |
| NAT Gateway | ~$1.08/day | From Day 1 |
| ALB + 2x t3.micro | ~$1.04/day | From Day 2 |
| **Total Day 4** | **~$3.01/day** | S3 adds ~zero |

**Nightly policy:** Delete `duokart-04-storage` (empty buckets including versions first, bills lock expires? Compliance 30d blocks delete — see teardown), then `duokart-03-data`, then `duokart-02-compute`. Keep VPC `duokart-01-vpc` up all week.

**Warning:** Bills bucket Compliance mode blocks object delete for 30 days. For nightly teardown, either use short 1-day retention for dev (`Days: 1`) or delete stack with `DeletionPolicy: Delete` + empty via `aws s3 rm --recursive` with bypass? Console delete will fail if locked objects remain. Easiest dev workaround: set bills default retention to 1 day, or use Governance mode for dev (allows admin delete). Decide together before deploy — Compliance is demo-impressive but teardown-painful.

---

## 9. Nightly Teardown

1. S3 → photos bucket → Empty (delete all versions) → confirm
2. S3 → bills bucket → Empty (if Compliance blocks, wait or use Governance for dev)
3. CloudFormation → `duokart-04-storage` → Delete stack → wait complete
4. CloudFormation → `duokart-03-data` → Delete (~5-10 mins for RDS)
5. CloudFormation → `duokart-02-compute` → Delete (~2-3 mins)
6. Keep `duokart-01-vpc`
7. Verify: S3 0 buckets with suffix, RDS 0, EC2 0

---

## 10. Definition of Done

- [x] `infra/04-storage.yaml` written and YAML-validated locally
- [x] Template pushed directly to `main`
- [x] Stack deployed as `duokart-04-storage` in `us-east-2`
- [x] Stack Status = `CREATE_COMPLETE`
- [x] Photos versioning + lifecycle on, public blocked
- [x] Bills bucket `Delete` policy, no lock (`ps-19` — Compliance lock dropped, see `8148bde`)
- [x] App `POST /uploads/url` returns presigned for both kinds, 400 on bad kind
- [x] PUT to presigned URL lands object in correct bucket
- [x] 5 screenshots captured and committed (`78fd935`)
- [x] Troubleshooting notes filled (especially bucket name collisions)
- [x] Cost impact documented

---

## Day 5 Starting Point

Queue tier: SQS → Lambda → DynamoDB (`duokart-orders`) → SNS buyer + owner. See `docs/day-5-queue.md` (when created).

**What you'll need from today:**
- Photos + bills bucket names (for Lambda + app)
- VPC stack name: `duokart-01-vpc`
- EC2 IAM role pattern (Lambda will need similar S3 + Dynamo + SNS rights)
