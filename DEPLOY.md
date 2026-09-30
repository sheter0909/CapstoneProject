# Deploy checklist (backend on Render, apps on Vercel/Expo)

## 0. Know the failure mode
- Render runs `rootDir: backend` → `npm install && npx prisma migrate deploy && npm run build`, then `npm start`.
- If ANY build step fails, the deploy fails and the **previous version keeps serving** — the app will look "stuck on old behavior".
- Known blocker: `20260930000001_add_waste_type_mixed` runs
  `ALTER TYPE "WasteType" ADD VALUE 'mixed'`, which PostgreSQL **refuses inside a
  transaction block** — and `prisma migrate deploy` wraps every migration in a
  transaction. If the Render Events log shows that error, apply the one-time fix
  in step 2, then redeploy.

## 1. Push to main
- `git push origin main` (Render auto-deploys `main`).

## 2. One-time fix if the enum migration fails on Render
In the Neon SQL editor (production database):
```sql
ALTER TYPE "WasteType" ADD VALUE IF NOT EXISTS 'mixed';
```
Then, from a machine with the production `DIRECT_URL`:
```sh
cd backend
npx prisma migrate resolve --applied "20260930000001_add_waste_type_mixed"
```
Redeploy on Render afterwards. Never edit migrations that already applied.

## 3. Confirm the backend deploy
- Render dashboard → service `ecotrack-api` → Events shows **Live** for the new commit.
- Check the version actually serving:
  ```sh
  curl <API_URL>/health
  # expect: {"status":"ok","commit":"<7-char-sha>"}
  ```
  The hash must match the pushed commit (`RENDER_GIT_COMMIT` is set by Render
  automatically). If it shows an old hash or no `commit` field, you are still on
  the old deploy.

## 4. Confirm the frontends
- Vercel projects for EcoTrackApp and EcoTrack-Admin show **Ready**.
- Each project must have **Root Directory** set correctly (`EcoTrackApp` /
  `EcoTrack-Admin`), otherwise it builds the wrong app or nothing.
- `EXPO_PUBLIC_API_URL` is **baked in at build time**: changing it requires a
  Vercel redeploy (or restarting `expo start` locally). A local Expo dev server
  uses the Render API by default.

## 5. Hard refresh + test
- Hard refresh the web app (`Ctrl+Shift+R`) to drop the cached bundle.
- Test: collector login → scan → **Not Segregated** + weight only → entry saves
  as `Mixed`, warning reads "First Warning" (not "a warning").
- Test: **Segregated** with no waste type → `422 "Choose a waste type."`.

## Required Render env vars
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN=1d`,
`NODE_ENV=production`, `CORS_ORIGINS` (must include `https://app.eco-track.online`
and the admin Vercel URL). Never commit real secrets — values stay in the
Render dashboard (`sync: false`).
