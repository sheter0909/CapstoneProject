# EcoTrack API

Express + PostgreSQL (Neon) API using Prisma for the Admin Portal, Household App, and Garbage Collector App.

## Run

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL`, `PROD_DB_HOST`, and a strong `JWT_SECRET`.
2. Run `npm install` and `npm run dev`.

The API listens on `http://localhost:4000` by default. Every response uses `{ success, data, message?, errors? }`.

For Neon, use the pooled connection string (hostname includes `-pooler`) for `DATABASE_URL`, which the API uses at runtime. Use the direct, non-pooled connection string for `DIRECT_URL`, which Prisma CLI commands use through `prisma.config.ts`. Set `PROD_DB_HOST` to the production database hostname only; local or other non-production backends warn at startup if their `DATABASE_URL` targets that host. Startup logs show only the database host and name, never connection credentials.

The `/health/db` and `/api/health/db` probes return a generic error message and a safe `code` value (`auth_failed`, `timeout`, or `unreachable`) on connection failure. Detailed error diagnostics are logged server-side with connection URLs and secret-like values redacted.

## Route groups

- `POST /api/auth/{admin|household|collector}/login`
- `POST /api/auth/{household|collector}/forgot-password`
- `POST /api/auth/{household|collector}/reset-password`
- `POST /api/auth/collector/change-password`
- Admin: `/api/dashboard/*`, `/api/households`, `/api/collectors`, `/api/archive/*`, `/api/activity-logs`, `/api/reports/*`
- Household: `/api/households/me`, `/api/households/me/history`, `/api/households/me/notifications`
- Collector: `/api/households/:id/summary`, `/api/collections`, `/api/collectors/me/*`

List endpoints accept `page` and `limit` and return `{ items, total, page, totalPages }` in `data`.

## Source layout

- `src/routes/` — one module per domain: `auth`, `households`, `collectors`, `collections`, `notifications`, `reports`, `activity`, plus shared `helpers`. `src/routes.ts` only composes them onto a single router (registration order preserved).
- `scripts/route-map.ts` — prints every registered route as `METHOD /path [middleware-count]` (sorted). Run `npx tsx scripts/route-map.ts` before/after touching routes; the outputs must be identical.

## Assumptions

- Inactive and archived accounts cannot log in; archived records remain queryable through Archive endpoints.
- Reset tokens are short-lived in-memory tokens. Use a persistent token store or email provider before production.
- `dailyCollectionTarget` and `recyclingParticipation` return zero until collection target/business rules are defined.
- Account identifiers are application-level strings (`householdId`, `collectorId`); JWT subjects use PostgreSQL UUIDs for admins and application IDs for households and collectors.
