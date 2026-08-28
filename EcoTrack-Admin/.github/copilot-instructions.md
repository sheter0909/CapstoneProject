<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## EcoTrack Admin Dashboard - Project Guidelines

### Project Overview
This is a Next.js capstone project for an admin dashboard managing residential waste management (EcoTrack). Features include authentication pages and a resident management system with QR code generation.

### Technology Stack
- Next.js 15 with TypeScript
- Tailwind CSS for styling
- QRCode React for QR generation
- NextAuth.js (ready for integration)

### Project Structure
- `/app/page.tsx` - Welcome home page
- `/app/login/page.tsx` - Login authentication page
- `/app/signup/page.tsx` - Account creation
- `/app/forgot-password/page.tsx` - Password recovery
- `/app/reset-password/page.tsx` - Password reset
- `/app/households/page.tsx` - Household management dashboard
- `/components/` - Reusable React components

### Key Features to Maintain
1. Green color scheme (EcoTrack branding)
2. Responsive, mobile-first design
3. Client-side interactivity with 'use client' directives
4. TypeScript for type safety
5. Tailwind CSS utility classes for styling

### Development Commands
- `npm run dev` - Start development server on localhost:3000
- `npm run build` - Build for production
- `npm run lint` - Run ESLint checks

### When Adding Features
1. Create new pages in `/app/[feature]/page.tsx`
2. Create reusable components in `/components/`
3. Use TypeScript interfaces for data structures
4. Maintain the green color scheme and responsive design
5. Add 'use client' directive for interactive components

### Important Notes
- All authentication is UI-only and ready for backend integration
- Database integration is needed for production use
- QR codes are generated client-side for demonstration
- Password validation and security measures should be added for production
