'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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

  const fillDemoCredentials = () => {
    setEmail('admin@ecotrack.local');
    setPassword('');
    setError('Enter the password for your Admin account.');
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full px-4">
        {/* Left side - Branding */}
        <div className="flex flex-col justify-center bg-green-700 rounded-lg p-8 text-white">
          <div className="mb-8">
            <div className="w-12 h-12 bg-green-500 rounded-lg mb-4"></div>
            <h1 className="text-3xl font-bold">EcoTrack</h1>
          </div>
          <h2 className="text-2xl font-bold mb-4">Welcome to EcoTrack</h2>
          <p className="text-green-100 text-sm leading-relaxed">
            Sign in to your account to manage household waste efficiently and monitor your community&apos;s environmental impact.
          </p>
          <div className="mt-8 bg-green-600 rounded-lg p-4">
            <p className="text-green-100 text-xs font-semibold mb-2">Admin access</p>
            <p className="text-white text-xs">Use the Admin account created in Neon.</p>
          </div>
        </div>

        {/* Right side - Login form */}
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome back</h2>
          <p className="text-gray-600 mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 transition hover:text-green-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58A2 2 0 0013.42 13.42" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 5.08A10.6 10.6 0 0112 5c4.42 0 8.15 2.4 9.8 6a10.8 10.8 0 01-3.2 4.2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.61 6.61A10.8 10.8 0 002.2 11c1.65 3.6 5.38 6 9.8 6 1.15 0 2.25-.14 3.3-.4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
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
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={fillDemoCredentials}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-lg transition"
            >
              Fill Demo Credentials
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
          </div>
        </div>
      </div>
    </main>
  );
}
