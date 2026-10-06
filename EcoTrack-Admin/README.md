# EcoTrack Admin Portal

Barangay admin portal (Next.js App Router + TypeScript + Tailwind CSS) backed by the EcoTrack Express API (`backend/`). Admins manage households, garbage collectors, announcements/notifications, reports with Excel export, and the activity log.

## Features

- **Login** — admin authentication against `POST /api/auth/admin/login` (JWT session).
- **Dashboard** — household/collector counts, recent activity.
- **Households / Garbage Collectors** — CRUD, archive/restore, collection history, QR codes.
- **Notifications** — send announcements, concerns inbox thread view.
- **Reports** — summary/weekly/waste-type/monthly charts plus Excel export (`lib/reportExport.ts`).
- **Activity log / Archive** — audit trail and archived accounts.

## Project Structure

```
EcoTrack-Admin/
├── app/
│   ├── page.tsx              # Root (redirects to login/dashboard)
│   ├── login/page.tsx        # Admin login
│   ├── dashboard/page.tsx    # Stats + recent activity
│   ├── households/page.tsx   # Household management
│   ├── garbage-collectors/page.tsx  # Collector management
│   ├── notifications/page.tsx
│   ├── reports/page.tsx
│   ├── activity-log/page.tsx
│   ├── archive/page.tsx
│   └── layout.tsx
├── components/               # Shared UI (ui.tsx, Modal, Pagination, AppShell)
├── lib/                      # API client (api.ts), export helpers
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm package manager
- The backend running (`../backend`, `npm run dev` on `http://localhost:4000`)

### Env

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to the backend URL including `/api` (defaults to the Render deploy if unset).

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (redirects to `/login` when signed out).

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Technologies Used

- **Next.js** (App Router) - React framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **qrcode.react** - QR code generation
- **xlsx** - Excel export for reports

## Page Routes

- `/` - Root (auth redirect)
- `/login` - Admin login
- `/dashboard` - Stats + recent activity
- `/households` - Household management
- `/garbage-collectors` - Collector management
- `/notifications` - Announcements + concerns inbox
- `/reports` - Analytics + Excel export
- `/activity-log` - Audit trail
- `/archive` - Archived accounts

## Notes

- Auth is JWT-backed via the Express API (no NextAuth); route guards check the stored session client-side.
- QR codes encode `household-{householdId}` for the collector app scanner.
- Responsive design works on mobile, tablet, and desktop.
