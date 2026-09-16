# API contracts — both sides build against this, no freelancing

Frozen Day 0 (changes need both to approve). Local base `http://localhost:5000`, AWS base = ALB DNS.

## HTTP endpoints (app)

| Method + path | Request | Success response | Errors |
|---|---|---|---|
| `POST /orders` | `OrderCreated` JSON (below) | `202` + `{"orderId": "...", "status": "RECEIVED"}` | `400` validation (missing items/total mismatch), `409` duplicate `orderId` with different payload |
| `GET /orders/:id` | — | `200` + `OrderStatus` JSON | `404` unknown id |
| `GET /products` | — | `200` + product list | — |
| `POST /uploads/url` | `{"kind": "photo"\|"bill", "filename": "..."}` | `200` + `{"uploadUrl": "<presigned>", "key": "..."}` | `400` bad kind |

Error shape: `{"error": "CODE", "message": "human text"}`.

## OrderCreated (app -> SQS)
```json
{
  "orderId": "ord-000042",
  "buyerEmail": "rahul@example.com",
  "items": [{"sku": "soap-neem-100g", "qty": 3, "price": 99}],
  "total": 297,
  "paymentRef": "upi-20260914-xyz"
}
```
- `orderId` is the idempotency key. `409` if same id with different payload; same payload re-POST is safe.
- `total` must equal sum(qty*price) or `400`.
- Producer returns HTTP 202 immediately; confirmation comes later by mail (SNS).

## OrderStatus (worker -> DynamoDB `duokart-orders`, PK `orderId`)
```json
{"orderId": "ord-000042", "status": "PACKING", "total": 297, "updatedAt": "2026-09-14T10:00:00Z"}
```
- `RECEIVED` -> `PACKING` -> `DONE` | `FAILED`
- Only forward transitions. Duplicate SQS delivery must not move status backward (conditional write on `orderId`).

## Notify (worker -> SNS)
- Buyer topic: "order received, packing" + bill link.
- Owner topic: "new order #id, items, address".

## Uploads (app -> S3 presigned URL)
- Photos -> `duokart-photos/`; bills/payment shots -> `duokart-bills/` (locked, kept).
- App never proxies file bytes; browser uploads direct to presigned URL.
- Bills bucket has Object Lock (compliance mode); versioning on both.

## How to verify locally (`AWS_MODE=local`)
1. `python -m app.run` → `POST /orders` sample above → expect `202` + `orderId`.
2. Re-POST identical body → `202` same id (idempotent). Changed body same id → `409`.
3. `GET /orders/ord-000042` → status `RECEIVED` → worker flips to `PACKING`.
