# Allo Inventory — Take-Home Exercise

A production-quality inventory reservation system built with Next.js 14 App Router, Prisma, PostgreSQL, and Redis.

## Live Demo

> Deploy to Vercel + Supabase/Neon + Upstash — see **Deployment** below.

---

## What's built

### API

| Method | Path | Behaviour |
|--------|------|-----------|
| `GET` | `/api/products` | List products with available stock per warehouse. Supports `?warehouseId=` and `?inStockOnly=true` filters. |
| `GET` | `/api/warehouses` | List warehouses with stock levels. |
| `POST` | `/api/reservations` | Create a reservation. Returns `409` on insufficient stock. Supports idempotency via `Idempotency-Key` header. |
| `GET` | `/api/reservations` | List reservations (supports `?status=` filter). |
| `GET` | `/api/reservations/:id` | Get a single reservation. |
| `POST` | `/api/reservations/:id/confirm` | Confirm a reservation. Returns `410` if expired. Idempotent. |
| `POST` | `/api/reservations/:id/release` | Release a reservation early. |
| `GET` | `/api/cron/expire-reservations` | Cron endpoint — release all expired pending reservations. |

### Frontend

- **Product listing** — live stock indicators, per-warehouse breakdown, low-stock warnings, reserve modal
- **Reservation detail** — live countdown timer, confirm/cancel actions, error surfaces for 409/410
- **Reservations list** — filterable table of all reservations

---

## Concurrency strategy

This is the core of the exercise. Two layers of protection are used:

### Layer 1 — Redis distributed lock

When a `POST /api/reservations` request arrives, the server acquires a Redis `SET NX PX` lock keyed to `allo:lock:reservation:{productId}:{warehouseId}` before reading stock. This means:

- Concurrent requests for the same SKU are serialised at the lock boundary.
- Only one request at a time can read-then-write the stock counter.
- The lock is held for a maximum of 5 seconds and released in a `finally` block.
- If Redis is unavailable, the code falls back to in-process execution (safe for single-instance dev, not production).

### Layer 2 — Postgres WHERE guard (defence in depth)

Inside the lock, stock is decremented with a raw SQL `UPDATE ... WHERE (totalUnits - reservedUnits) >= quantity`. If the row was modified between the lock check and the UPDATE (e.g. during a Redis network partition), the `rowsAffected` count will be 0 and the transaction rolls back with an `InsufficientStockError`.

This two-layer approach means: **no double-booking is possible** even under extreme concurrency or partial infrastructure failure.

---

## Reservation expiry

Three complementary mechanisms:

1. **Vercel Cron (production)** — `vercel.json` schedules `GET /api/cron/expire-reservations` every minute. The endpoint finds all `PENDING` reservations with `expiresAt < now`, decrements their reserved stock, and sets status to `EXPIRED`. Protected by a `CRON_SECRET` bearer token.

2. **Lazy cleanup on read** — Every call to `GET /api/products` triggers `releaseExpiredReservations()` as a side effect. This ensures stock is always fresh, even in environments without a cron scheduler.

3. **Confirm-time check** — If a client calls `POST /api/reservations/:id/confirm` after expiry, the server rejects it with a `410 Gone` and releases the stock at that point too.

---

## Idempotency

The `POST /api/reservations` and `POST /api/reservations/:id/confirm` endpoints support the `Idempotency-Key` header.

**Implementation:**
- On first request: process normally, then write `(key, endpoint, responseBody, statusCode, expiresAt)` to the `IdempotencyRecord` table.
- On retry with same key: return the cached response verbatim with `X-Idempotent-Replay: true` header — no side effects.
- Keys expire after 24 hours.

This is safe against retried payments, double-clicks, and network timeout retries.

---

## Running locally

### Prerequisites

- Node.js 18+
- A PostgreSQL database (Supabase, Neon, Railway — all have free tiers)
- Redis instance (Upstash free tier) — optional but recommended

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd allo-inventory

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL (and optionally REDIS_URL)

# 4. Push schema to database
npm run db:push

# 5. Seed with sample data
npm run db:seed

# 6. Start dev server
npm run dev
```

Open http://localhost:3000

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Recommended | Redis for distributed locking |
| `CRON_SECRET` | Production | Protects the cron endpoint |

---

## Deployment (Vercel + Supabase + Upstash)

1. **Supabase** — create a project, copy the connection string (use the pooler URL for serverless)
2. **Upstash** — create a Redis database, copy the `REDIS_URL`
3. **Vercel** — import the repo, add env vars, deploy
4. Run `npm run db:seed` against the production DB once
5. The Vercel Cron in `vercel.json` will start automatically on paid plans; on free tier, lazy cleanup handles expiry.

---

## Trade-offs and what I'd do differently

### What I made deliberately simpler

- **No auth** — a real system would have user sessions tied to reservations. The current API is open.
- **Single reservation per checkout** — real carts can have multiple SKUs; the atomic multi-item reservation is more complex.
- **No payment integration** — the confirm endpoint simulates what a payment webhook would call.
- **Idempotency in Postgres** — for very high throughput, Redis would be faster for idempotency record storage.

### What I'm happy with

- The two-layer concurrency guarantee (Redis lock + DB WHERE guard) is robust without needing `SELECT FOR UPDATE`.
- Clean separation: domain logic lives in `lib/reservations.ts`, HTTP layer is thin.
- Zod schemas are shared between API validation and could easily extend to client-side forms.
- Lazy cleanup means the app degrades gracefully when the cron is unavailable.

### With more time

- Add Prometheus metrics on reservation creation latency, lock contention rate, and expiry counts
- Stress test with k6 or autocannon to measure p99 latency under concurrency
- Add pagination to the reservations list
- WebSocket or SSE for real-time stock updates across browser tabs
