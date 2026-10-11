'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

const PUBLIC_PATHS = ['/', '/login'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setMounted(true);
    setAuthed(!!window.localStorage.getItem('authToken'));
  }, [pathname]);
  const showSidebar = mounted && authed && !PUBLIC_PATHS.includes(pathname);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const mobileOpen = showSidebar && drawerRequested;

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('adminUser');
    setAuthed(false);
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
