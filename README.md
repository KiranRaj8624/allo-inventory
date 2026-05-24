# Allo Inventory — Multi-Warehouse Reservation Platform

A production-grade inventory reservation system built for the Allo take-home exercise. Handles race-condition-free reservations across multiple warehouses with distributed locking, real-time updates, and idempotency.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js App Router                  │
│                                                         │
│  /          Products listing (real-time stock)          │
│  /checkout/[id]   Reservation checkout + countdown      │
│  /admin           Inventory dashboard                   │
│  /admin/analytics Charts + trends                       │
│  /admin/logs      Audit trail                           │
│  /admin/simulator Concurrency test tool                 │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   API Routes      Supabase RT     Vercel Cron
   (App Router)    (Realtime)      (Expiry)
        │
        ├── Service Layer (business logic)
        │       reservation.service.ts
        │
        ├── Repository Layer (data access)
        │       product / inventory /
        │       reservation / idempotency
        │
        ├── Redis (Upstash)
        │       Distributed lock per product+warehouse
        │
        └── PostgreSQL (Supabase)
                Prisma ORM + transactions
```

---

## Database Schema

```
Product ──< Inventory >── Warehouse
   │                          │
   └──< Reservation >─────────┘
             │
             └──< ReservationEvent

IdempotencyKey  (standalone)
```

---

## Concurrency Strategy

The reservation endpoint must be correct under concurrent load. The approach uses two layers of protection:

### Layer 1 — Redis Distributed Lock

Before touching the database, we acquire a per-inventory lock:

```
Key:   inventory:{productId}:{warehouseId}
Value: random UUID (so only the owner can release it)
TTL:   10 seconds (SET ... NX PX 10000)
```

- `NX` means "only set if the key does not exist" — atomic acquire
- If two requests race, exactly one gets `OK`; the other gets `nil` → 429
- On completion or error, the lock is released via a Lua script that checks ownership before deleting

### Layer 2 — Prisma Database Transaction

Inside the lock, all reads and writes run in a single serializable transaction:

```
BEGIN TRANSACTION
  1. SELECT inventory WHERE productId + warehouseId
  2. CHECK available = totalUnits - reservedUnits >= quantity
  3. FAIL with 409 if unavailable
  4. UPDATE inventory SET reservedUnits += quantity
  5. INSERT reservation (status = PENDING)
  6. INSERT reservation_event (RESERVATION_CREATED)
COMMIT
```

This double-guard means even if two requests somehow both acquire a lock (e.g. Redis TTL edge case), the DB transaction prevents a double-decrement.

**Result:** 100 simultaneous requests for 1 unit → exactly 1 succeeds, 99 get 409.

---

## Idempotency Design

Endpoints supporting the `Idempotency-Key` header:

- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`

Flow:
1. Extract `Idempotency-Key` header
2. Look up key in `IdempotencyKey` table
3. If found → return cached JSON response with `Idempotent-Replayed: true`
4. If not found → execute normally, store response + key

This prevents duplicate reservations if a client retries due to a network timeout.

---

## Reservation Expiry

Reservations expire after 10 minutes if not confirmed.

**Production mechanism:** Vercel Cron fires `GET /api/cron/expire-reservations` every minute.

The cron handler:
1. Queries all `PENDING` reservations where `expiresAt < NOW()`
2. For each, runs a transaction: decrement `reservedUnits`, set status to `EXPIRED`, insert audit event
3. Returns count of expired reservations

The endpoint is protected by a `CRON_SECRET` bearer token set in Vercel environment variables.

**Alternative approaches considered:**
- *Lazy cleanup on read* — simpler but means stale data lingers; chose cron for accuracy
- *Background worker* — not available on Vercel hobby; Cron is the idiomatic choice

---

## Real-time Updates

Uses Supabase Realtime (Postgres logical replication → websocket broadcast).

Subscriptions:
- `Inventory` table changes → refresh product list (stock numbers update live)
- `Reservation` row update → refresh checkout page (status change shows instantly)
- `Reservation` + `Inventory` changes → refresh admin dashboard

---

## Local Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- An Upstash Redis database (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/allo-inventory
cd allo-inventory
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Wait for provisioning (~2 min)
3. Go to **Settings → Database → Connection string**
4. Copy the **Transaction pooler** URI (port 6543) → `DATABASE_URL`
5. Copy the **Direct connection** URI (port 5432) → `DIRECT_URL`
6. Go to **Settings → API**
7. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
8. Copy **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Enable Realtime on your tables:**
- Go to **Database → Replication**
- Enable for tables: `Inventory`, `Reservation`

### 3. Set up Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com) → Create Database
2. Choose region closest to your Supabase region
3. Copy **REST URL** → `UPSTASH_REDIS_REST_URL`
4. Copy **REST Token** → `UPSTASH_REDIS_REST_TOKEN`

### 4. Configure environment

```bash
cp .env.example .env.local
# Fill in all values from steps 2 and 3
```

Your `.env.local` should look like:

```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
UPSTASH_REDIS_REST_URL="https://[id].upstash.io"
UPSTASH_REDIS_REST_TOKEN="AX..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CRON_SECRET="any-random-secret-string"
```

### 5. Push schema and seed

```bash
# Generate Prisma client
npm run db:generate

# Push schema to Supabase (creates all tables)
npm run db:push

# Seed with 10 products, 5 warehouses, inventory + history
npm run db:seed
```

### 6. Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Deployment to Vercel

### Step 1 — Push to GitHub

```bash
# In your project folder
git init
git add .
git commit -m "feat: initial implementation"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/allo-inventory.git
git branch -M main
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your `allo-inventory` repo
4. Vercel auto-detects Next.js — leave all build settings as default

### Step 3 — Add Environment Variables

In Vercel project settings → **Environment Variables**, add every key from your `.env.local`:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Supabase transaction pooler URL |
| `DIRECT_URL` | Supabase direct URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL (e.g. `https://allo-inventory.vercel.app`) |
| `CRON_SECRET` | Any random secret string |

> ⚠️ **Important:** Set `NEXT_PUBLIC_APP_URL` to your actual Vercel URL. The concurrency simulator uses it to fire internal API requests.

### Step 4 — Deploy

Click **Deploy**. Vercel builds and deploys automatically.

### Step 5 — Verify cron

The `vercel.json` file already configures the cron job:

```json
{
  "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "* * * * *" }]
}
```

After deployment, go to **Vercel Dashboard → your project → Cron Jobs** to confirm it is registered and running every minute.

### Step 6 — Enable Supabase Realtime (production)

In your Supabase dashboard:
1. **Database → Replication**
2. Toggle on `Inventory` and `Reservation` tables

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # / Products listing
│   ├── checkout/[id]/page.tsx            # Reservation checkout
│   ├── admin/
│   │   ├── page.tsx                      # Dashboard
│   │   ├── analytics/page.tsx
│   │   ├── logs/page.tsx
│   │   └── simulator/page.tsx
│   └── api/
│       ├── products/route.ts
│       ├── warehouses/route.ts
│       ├── reservations/
│       │   ├── route.ts                  # POST create
│       │   └── [id]/
│       │       ├── route.ts              # GET single
│       │       ├── confirm/route.ts
│       │       └── release/route.ts
│       ├── cron/expire-reservations/route.ts
│       └── admin/
│           ├── dashboard/route.ts
│           ├── analytics/route.ts
│           ├── logs/route.ts
│           └── simulate-concurrency/route.ts
├── components/
│   ├── navbar.tsx
│   ├── providers.tsx
│   ├── ui/                               # shadcn/ui primitives
│   └── features/
│       ├── inventory/
│       │   ├── product-card.tsx
│       │   └── stock-health.tsx
│       ├── reservation/
│       │   ├── reserve-button.tsx
│       │   ├── status-badge.tsx
│       │   └── countdown.tsx
│       └── analytics/
│           └── stat-card.tsx
├── lib/
│   ├── db/index.ts                       # Prisma singleton
│   ├── redis/index.ts                    # Upstash + lock helpers
│   ├── supabase/client.ts
│   └── utils.ts
├── repositories/
│   ├── product.repository.ts
│   ├── inventory.repository.ts
│   ├── reservation.repository.ts
│   └── idempotency.repository.ts
├── services/
│   └── reservation.service.ts            # Core business logic
├── hooks/
│   └── use-toast.ts
├── types/index.ts
└── validators/index.ts
```

---

## Trade-offs and Decisions

**Redis lock before DB transaction** — The lock prevents most concurrent requests from even hitting the database, keeping DB load low. The transaction is a safety net for edge cases. Alternatively, a `SELECT FOR UPDATE` advisory lock purely in Postgres would work but requires a persistent connection pool, which Supabase's pgBouncer doesn't support in transaction mode.

**Vercel Cron for expiry** — Simple and zero-infrastructure. The downside is 1-minute granularity; if you need second-level expiry, a dedicated worker (BullMQ on Railway, etc.) is better. For a 10-minute window, ±1 minute is acceptable.

**Supabase Realtime** — Uses Postgres logical replication. It's eventually consistent (small lag between DB write and websocket broadcast), but for stock updates this is fine. The UI also has a 30-second polling fallback via React Query's `refetchInterval`.

**No auth** — Skipped to keep scope focused on the reservation logic itself. In production, Supabase Auth + RLS policies would protect both the API and the database directly.

---

## What I'd Add With More Time

- Auth (Supabase Auth + RLS)
- Rate limiting per IP on the reservation endpoint
- Unit and integration tests with Vitest + a test database
- Webhook support so downstream systems (payment processor, WMS) can subscribe to reservation events
- `SELECT FOR UPDATE SKIP LOCKED` as a Postgres-native alternative to Redis locking
