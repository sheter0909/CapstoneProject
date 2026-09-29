'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Sidebar from './Sidebar';

const PUBLIC_PATHS = ['/', '/login'];

function isAuthenticated(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage.getItem('authToken');
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = isAuthenticated() && !PUBLIC_PATHS.includes(pathname);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const mobileOpen = showSidebar && drawerRequested;

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminUser');
    setDrawerRequested(false);
  };

  return (
    <>
      {showSidebar && (
        <>
          <Sidebar onLogout={handleLogout} isOpen={mobileOpen} onClose={() => setDrawerRequested(false)} />
          <button
            type="button"
            onClick={() => setDrawerRequested(true)}
            className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-green-200 bg-white/95 text-green-700 shadow-sm transition hover:bg-green-50 md:hidden"
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setDrawerRequested(false)}
              className="fixed inset-0 z-30 bg-black/20 md:hidden"
              aria-label="Close navigation"
            />
          )}
        </>
      )}
      <div className={showSidebar ? 'md:pl-72' : ''}>{children}</div>
    </>
  );
}
