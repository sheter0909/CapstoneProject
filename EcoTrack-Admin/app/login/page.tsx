'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Fire-and-forget: warm up backend instance and database connection on login mount
    adminApi.healthDb();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEmail = email.trim();
    try {
      const result = await adminApi.login(normalizedEmail, password);
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('adminUser', JSON.stringify(result.account));
      router.push('/dashboard');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden md:flex w-1/2 flex-col justify-between bg-[#0F6B4B] px-12 py-10 text-white">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="EcoTrack logo" width={56} height={56} className="h-14 w-14 rounded-2xl object-contain drop-shadow-sm" />
          <div>
            <p className="text-xl font-bold leading-tight">EcoTrack</p>
            <p className="text-[11px] tracking-wide text-emerald-100/70">Admin Web Portal</p>
          </div>
        </div>

        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">Smarter waste management starts here.</h1>
          <p className="mt-4 text-base leading-relaxed text-emerald-100/80">
            Manage households, monitor waste collection activity, and generate data-driven reports all from one centralized dashboard.
          </p>

          <div className="mt-10 space-y-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 19a4 4 0 00-8 0" />
                  <circle cx="12" cy="9" r="3.2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 19a3 3 0 00-2.4-2.94M19 9.5a2.5 2.5 0 010 5M5 19a3 3 0 012.4-2.94M5 9.5a2.5 2.5 0 000 5" />
                </svg>
              </span>
              <div>
                <p className="text-lg font-semibold">Households Management</p>
                <p className="text-sm text-emerald-100/90">Enroll households and issue QR identifiers.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2.5-6 4 12L16 12h2l1.5 2H21" />
                </svg>
              </span>
              <div>
                <p className="text-lg font-semibold">Activity Logs</p>
                <p className="text-sm text-emerald-100/90">Track biodegradable & recyclable disposal in real time.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
                </svg>
              </span>
              <div>
                <p className="text-lg font-semibold">Reports & Analytics</p>
                <p className="text-sm text-emerald-100/90">Filter, visualize, and export PDF/CSV reports.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-emerald-100/60">©{new Date().getFullYear()} EcoTrack. A dual-platform waste management system.</p>
      </div>

      {/* Right panel */}
      <div className="flex w-full md:w-1/2 items-center justify-center bg-[#E0EDE5] px-4">
        <div className="w-full max-w-[520px] rounded-2xl bg-[#EAF3EC] p-6 sm:p-12 shadow-[0_8px_30px_rgba(15,107,75,0.12)]">
          <div className="mb-6 flex md:hidden items-center gap-3">
            <Image src="/logo.png" alt="EcoTrack logo" width={48} height={48} className="h-12 w-12 rounded-xl object-contain drop-shadow-sm" />
            <div>
              <p className="text-xl font-bold leading-tight text-gray-900">EcoTrack</p>
              <p className="text-xs text-gray-500">Admin Web Portal</p>
            </div>
          </div>
          <h2 className="text-[28px] sm:text-4xl font-semibold text-gray-800">Welcome to EcoTrack</h2>
          <p className="mt-2 mb-8 text-base text-gray-500">Secure access for environmental officers.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 bg-[#E4F1E7] pl-12 pr-4 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-600 placeholder:text-gray-400"
                  placeholder="admin@ecotrack.local"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 018 0v3" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 bg-[#E4F1E7] pl-12 pr-12 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-600 placeholder:text-gray-400"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-4 flex items-center text-gray-500 transition hover:text-green-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A2 2 0 0013.42 13.42" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.08A10.6 10.6 0 0112 5c4.42 0 8.15 2.4 9.8 6a10.8 10.8 0 01-3.2 4.2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.61 6.61A10.8 10.8 0 002.2 11c1.65 3.6 5.38 6 9.8 6 1.15 0 2.25-.14 3.3-.4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 mt-7 bg-[#3E8E6A] hover:bg-[#2F7054] disabled:bg-gray-400 text-white font-semibold text-lg px-4 rounded-xl transition"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
