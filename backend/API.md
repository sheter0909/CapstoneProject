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

## Collector app

| Method | Path | Body | Auth |
|---|---|---|---|
| GET | `/households/:id/summary` | none | collector |
| POST | `/collections` | `{ householdId, segregationStatus, wasteType, weightKg }` | collector |
| GET | `/collectors/me/activity-logs` | none | collector |
| GET | `/collectors/me/reports` | none | collector |

`weightKg` is limited to 15. `segregationStatus` is `segregated` or `not_segregated`; `wasteType` is `biodegradable`, `recyclable`, or `non-biodegradable`.
