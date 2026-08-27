'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

type SidebarProps = {
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
};

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5v-9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    id: 'households',
    label: 'Household Management',
    href: '/households',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1v-9.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-4h6v4" />
      </svg>
    ),
  },
  {
    id: 'garbage-collectors',
    label: 'Garbage Collectors',
    href: '/garbage-collectors',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 18h14" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 18V9.5A2.5 2.5 0 0 1 9.5 7H14.5A2.5 2.5 0 0 1 17 9.5V18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18v-2.5A1.5 1.5 0 0 1 10.5 14h3A1.5 1.5 0 0 1 15 15.5V18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6" />
      </svg>
    ),
  },
  {
    id: 'archive',
    label: 'Archived Accounts',
    href: '/archive',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v8" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Activity Logs',
    href: '/activity-log',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v4M17 3v4M4 8h16" />
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    href: '/reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19V9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 19v-7" />
      </svg>
    ),
  },
];

export default function Sidebar({ onLogout, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    onLogout();
    router.push('/');
  };

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-green-100 bg-white/95 px-4 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600 text-lg font-semibold text-white shadow-sm">
              E
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">EcoTrack</p>
              <p className="text-xs text-gray-500">Barangay Admin Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-white hover:text-green-700 md:hidden"
            aria-label="Close navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="mt-6 flex-1">
          <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
            Main Menu
          </p>
          <ul className="space-y-1.5">
            {menuItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200'
                      : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive(item.href) ? 'bg-green-600 text-white' : 'bg-white text-gray-500'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white">
                AU
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">Admin User</p>
                <p className="text-xs text-gray-500">Barangay Admin</p>
              </div>
              <button
                type="button"
                className="ml-auto rounded-full p-2 text-gray-500 transition hover:bg-white hover:text-green-700"
                aria-label="Open profile"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 6 7-6 7" />
                </svg>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition hover:border-green-300 hover:bg-green-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
            </svg>
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
