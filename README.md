# Allo Inventory — Take-Home Exercise

A Next.js 15 inventory and reservation system with race-condition-safe stock holds.

Live URL: https://allo-inventory-git-main-ranjani-v-s-projects.vercel.app
Repo: https://github.com/Ranjani023/allo-inventory

---

## Running locally

### Prerequisites

- Node 18+
- A hosted Postgres database (Supabase or Neon — both have free tiers)
- An Upstash Redis instance (free tier) — optional, degrades gracefully if absent

### 1. Clone and install

```bash
git clone <repo>
cd allo-inventory
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# Supabase: Settings > Database > Connection string (Transaction pooler for DATABASE_URL)
DATABASE_URL="postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Neon alternative:
# DATABASE_URL="postgresql://[user]:[password]@[host]/[db]?sslmode=require"
# DIRECT_URL same as DATABASE_URL

# Upstash Redis (optional — idempotency disabled if absent)
REDIS_URL="rediss://:[password]@[host]:6379"

# Cron auth (optional — used by /api/cron/expire)
CRON_SECRET="your-secret-here"

# Reservation hold window in minutes (default: 10)
RESERVATION_TTL_MINUTES=10
```

### 3. Migrate and seed

```bash
# Push schema to your hosted DB
npx prisma db push

# Seed with products, warehouses, and stock levels
npm run db:seed
```

### 4. Run

```bash
npm run dev
# → http://localhost:3000
```

---

## How expiry works in production

Two complementary mechanisms:

**1. Lazy cleanup (always active)**  
Every `GET /api/products` call runs `releaseExpiredReservations()` before querying stock. This means available counts are always fresh for the product listing. Individual reservation reads (`GET /api/reservations/:id`) also check and expire on the fly.

**2. Vercel Cron (production)**  
2. Vercel Cron (production)
The /api/cron/expire endpoint exists and can be triggered externally.
On the Hobby plan, Vercel Cron requires daily schedule minimum — 
lazy cleanup handles expiry in the interim.

The two mechanisms are idempotent: `UPDATE ... WHERE status = 'PENDING' AND expiresAt < NOW()` is safe to run concurrently.

---

## Concurrency correctness

The core guarantee is in `POST /api/reservations`:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

SELECT id, total, reserved
FROM stock
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE;                    -- row-level lock acquired here

-- If available < qty → ROLLBACK → 409
-- Otherwise:
UPDATE stock SET reserved = reserved + $qty WHERE id = $stockId;
INSERT INTO reservations (...);

COMMIT;
```

When two requests race for the last unit:
1. Request A acquires the `FOR UPDATE` lock and reads `available = 1`.
2. Request B attempts the same `SELECT FOR UPDATE` and **blocks** until A commits.
3. A commits: `reserved` is now incremented, `available = 0`.
4. B unblocks, re-reads `available = 0`, throws `INSUFFICIENT_STOCK` → 409.

Exactly one reservation is created. No over-selling.

`isolationLevel: "Serializable"` is set on the Prisma transaction as belt-and-suspenders — it prevents phantom reads in more complex scenarios.

---

## Idempotency (bonus)

`POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header.

On first request: the response is stored in Redis at key `idem:{key}` with a 24-hour TTL.  
On retry with the same key: the cached response is returned immediately, with no side effects.

This protects against double-charges when a payment webhook fires twice, or a client retries after a network timeout.

If Redis is unavailable, the header is silently ignored — the endpoints remain functional, just without idempotency guarantees.

---

## Trade-offs and what I'd do differently

**What I'd improve with more time:**

- **Auth** — reservations are currently unauthenticated. In production, tie a reservation to a session/user ID and verify ownership before confirm/release.
- **Webhook endpoint** — payment providers (Stripe, Razorpay) POST to a webhook. I'd add `POST /api/webhooks/payment` that confirms or releases based on the event type and maps `payment_intent_id` → `reservation_id`.
- **Multi-unit reservations** — the schema supports `qty > 1` but the UI only reserves 1. Worth exposing a quantity selector.
- **Optimistic UI** — the product listing re-fetches after reserve. Could use `useOptimistic` to decrement the count immediately.
- **Tests** — I'd write integration tests for the `SELECT FOR UPDATE` path using `pg` directly and running concurrent requests to verify exactly-one semantics.
- **Cron auth** — the CRON_SECRET check should also verify the `x-vercel-cron` header in production.

**Deliberate simplifications:**

- No ORM for the `FOR UPDATE` query — Prisma doesn't support `SELECT FOR UPDATE` in its query builder as of v5, so I used `$queryRaw`. The rest of the codebase uses the Prisma client normally.
- Available stock is computed (`total - reserved`) not stored — avoids a drift vector.
- Redis is optional — idempotency degrades gracefully rather than making the whole app depend on it.
