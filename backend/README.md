# EcoTrack API

Express + PostgreSQL (Neon) API using Prisma for the Admin Portal, Household App, and Garbage Collector App.

## Run

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `DIRECT_URL`, and a strong `JWT_SECRET`.
2. Run `npm install` and `npm run dev`.

The API listens on `http://localhost:4000` by default. Every response uses `{ success, data, message?, errors? }`.

## Route groups

- `POST /api/auth/{admin|household|collector}/login`
- `POST /api/auth/{household|collector}/forgot-password`
- `POST /api/auth/{household|collector}/reset-password`
- `POST /api/auth/collector/change-password`
- Admin: `/api/dashboard/*`, `/api/households`, `/api/collectors`, `/api/archive/*`, `/api/activity-logs`, `/api/reports/*`
- Household: `/api/households/me`, `/api/households/me/history`, `/api/households/me/notifications`
- Collector: `/api/households/:id/summary`, `/api/collections`, `/api/collectors/me/*`

List endpoints accept `page` and `limit` and return `{ items, total, page, totalPages }` in `data`.

## Assumptions

- Inactive and archived accounts cannot log in; archived records remain queryable through Archive endpoints.
- Reset tokens are short-lived in-memory tokens. Use a persistent token store or email provider before production.
- `dailyCollectionTarget` and `recyclingParticipation` return zero until collection target/business rules are defined.
- Account identifiers are application-level strings (`householdId`, `collectorId`); JWT subjects use PostgreSQL UUIDs for admins and application IDs for households and collectors.
