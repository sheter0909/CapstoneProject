# EcoTrack Admin Dashboard - Next.js Capstone

A comprehensive residential waste management admin dashboard built with Next.js, TypeScript, and Tailwind CSS.

## Features

### Authentication System
- **Login Page** - Secure admin authentication
- **Signup Page** - Create new admin accounts
- **Forgot Password** - Password recovery flow
- **Reset Password** - Secure password reset

### Household Management
- **Household List** - View all households with details
- **Household Search & Filter** - Find specific households
- **QR Code Generation** - Generate household QR codes for waste tracking
- **Status Management** - Track active/inactive households

### Dashboard
- Responsive design with Tailwind CSS
- Clean, modern UI with green branding (EcoTrack theme)
- Mobile-friendly interface

## Project Structure

```
EcoTrack-Admin/
├── app/
│   ├── page.tsx              # Welcome home page
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── signup/
│   │   └── page.tsx          # Signup page
│   ├── forgot-password/
│   │   └── page.tsx          # Forgot password page
│   ├── reset-password/
│   │   └── page.tsx          # Reset password page
│   ├── households/
│   │   └── page.tsx          # Household management page
│   ├── layout.tsx
│   └── globals.css
├── components/               # Reusable components (for future expansion)
├── public/
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **QRCode React** - QR code generation
- **NextAuth.js** - Authentication (ready for integration)

## Page Routes

- `/` - Welcome/Home page
- `/login` - Admin login
- `/signup` - Create new account
- `/forgot-password` - Password recovery
- `/reset-password` - Reset password
- `/households` - Household management dashboard

## Future Enhancements

- [ ] Backend API integration
- [ ] Database setup (PostgreSQL/MongoDB)
- [ ] Authentication implementation
- [ ] Waste tracking analytics
- [ ] Notification system
- [ ] Dashboard statistics and charts
- [ ] Export resident data

## Notes

- All authentication pages are UI-only and ready for backend integration
- QR codes are generated client-side for demonstration
- Responsive design works on mobile, tablet, and desktop

---

**Status**: Development Phase - UI Complete, Ready for Backend Integration
# CapstoneAdmin
