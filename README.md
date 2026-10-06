# EcoTrack (CapstoneProject)

EcoTrack is a barangay waste management system: households view collection history, notifications, and QR codes; garbage collectors log collections by scanning household QR codes; admins manage households, collectors, announcements, and reports.

## Folders

- `backend/` — Express 5 + Prisma 7 + Neon Postgres API (`src/routes.ts`, `auth.ts`, `middleware.ts`, `validators.ts`). Every response uses `{ success, data, message?, errors? }`.
- `EcoTrack-Admin/` — Next.js admin portal.
- `EcoTrackApp/` — Expo / React Native app with household and garbage collector portals.

## Run each part

Backend:

1. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`, `DIRECT_URL`, and a strong `JWT_SECRET`.
2. `cd backend` and run `npm install`, then `npm run dev` (API on `http://localhost:4000`).

Admin portal:

1. `cd EcoTrack-Admin` and run `npm install`, then `npm run dev`.
2. Set `NEXT_PUBLIC_API_URL` to the backend URL including `/api` (defaults to the Render deploy).

Mobile app:

1. `cd EcoTrackApp` and run `npm install`, then `npx expo start`.
2. Set `EXPO_PUBLIC_API_URL` to the backend URL (the `/api` suffix is appended automatically if omitted).

## Env vars

- Backend: `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS` (see `backend/.env.example`).
- Admin: `NEXT_PUBLIC_API_URL` (see `EcoTrack-Admin/.env.example`).
- App: `EXPO_PUBLIC_API_URL` (see `EcoTrackApp/.env.example`).

## Deploy

- Backend on Render (`render.yaml`, `rootDir: backend`): build `npm install && npx prisma migrate deploy && npm run build`, start `npm start`, health check `/health`. Full checklist in `DEPLOY.md` (including the one-time Neon enum-migration fix).
- Admin + App website on Vercel with the correct **Root Directory** (`EcoTrack-Admin` / `EcoTrackApp`). `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL` are baked in at build time — redeploy after changing them.
- Android APK: `EcoTrackApp/README.md` → "Build the Android APK" (`npm run build:apk` via EAS, then publish through GitHub Releases + `EXPO_PUBLIC_APK_URL`).
