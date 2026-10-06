# EcoTrack API Reference

Base URL: `http://localhost:4000/api`. Protected requests send `Authorization: Bearer <JWT>`.
All responses are `{ success, data, message?, errors? }`. Lists return `data: { items, total, page, totalPages }`.

## Authentication

| Method | Path | Body | Auth |
|---|---|---|---|
| POST | `/auth/admin/login` | `{ identifier, password }` | none |
| POST | `/auth/household/login` | `{ identifier, password }` | none |
| POST | `/auth/collector/login` | `{ identifier, password }` | none |
| POST | `/auth/household/forgot-password` | `{ identifier, birthdate }` | none |
| POST | `/auth/collector/forgot-password` | `{ identifier, birthdate }` | none |
| POST | `/auth/household/reset-password` | `{ resetToken, password }` | none |
| POST | `/auth/collector/reset-password` | `{ resetToken, password }` | none |
| POST | `/auth/collector/change-password` | `{ currentPassword, newPassword }` | collector |

## Admin

| Method | Path | Auth |
|---|---|---|
| GET | `/dashboard/stats` | admin |
| GET | `/dashboard/recent-activity` | admin |
| GET/POST | `/households` | admin |
| PUT/PATCH | `/households/:id`, `/households/:id/archive`, `/households/:id/unarchive` | admin |
| GET/POST | `/collectors` | admin |
| PUT/PATCH | `/collectors/:id`, `/collectors/:id/archive`, `/collectors/:id/unarchive` | admin |
| GET | `/archive/households`, `/archive/collectors` | admin |
| GET | `/households/:id/collections` | admin |
| GET | `/households/:id/summary` | collector |
| GET | `/collections` | admin |
| GET | `/collectors/:id/collections` | admin |
| GET | `/activity-logs` | admin |
| GET | `/reports/summary`, `/reports/weekly-collection`, `/reports/waste-type-distribution`, `/reports/monthly-performance` | admin |

Household create/update fields: `householdId`, `fullName`, `purok`, `address`, `birthdate`, `password`.
Collector create/update fields: `collectorId` optional on create, `fullName`, `assignedArea`, `contactNumber`, `birthdate`, `password`.
List query parameters: `page`, `limit`; households also support `search`; activity logs support `status`.

## Household app

| Method | Path | Auth |
|---|---|---|
| GET | `/households/me` | household |
| GET | `/households/me/history` | household |
| GET | `/households/me/notifications` | household |

History and activity entries carry `editable` + `editableUntil` (collectors may edit their own entry within `EDIT_WINDOW_HOURS`, default 24).

## Collector app

| Method | Path | Body | Auth |
|---|---|---|---|
| GET | `/households/:id/summary` | none | collector |
| POST | `/collections` | `{ householdId, segregationStatus, wasteType, weightKg }` | collector |
| PUT | `/collections/:id` | `{ segregationStatus, wasteType, weightKg }` | collector (own entries, within edit window) |
| GET | `/collectors/me/activity-logs` | none | collector |
| GET | `/collectors/me/reports` | none | collector |
| GET | `/collectors/me/notifications` | none | collector |

## Notifications (all roles)

| Method | Path | Auth |
|---|---|---|
| POST | `/notifications` | admin, collector, household (role-restricted recipients) |
| GET | `/notifications` | admin |
| PATCH | `/notifications/:id/read` | admin, collector, household (owners only, except admin) |

`weightKg` is limited to 15. `segregationStatus` is `segregated` or `not_segregated`; `wasteType` is `biodegradable`, `recyclable`, `non-biodegradable`, or `mixed` (stored automatically for not-segregated entries). Submitting a not-segregated entry creates a household warning (`warning: { level, count }`); editing back to segregated retracts it (`warningRemoved: true`).

## Health

`GET /health` (and `GET /`) returns `{ status: 'ok', commit }` where `commit` is the 7-char Render git SHA (`local` in dev).
