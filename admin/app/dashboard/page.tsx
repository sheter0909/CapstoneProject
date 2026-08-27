'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Household {
  id: string;
  name: string;
  email: string;
  unit: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
}

interface AdminUser {
  email: string;
  name: string;
}

const defaultHouseholds: Household[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    unit: 'Apt 101',
    joinDate: '2024-01-15',
    status: 'active',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    unit: 'Apt 202',
    joinDate: '2024-02-20',
    status: 'active',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    unit: 'Apt 303',
    joinDate: '2024-03-10',
    status: 'inactive',
  },
  {
    id: '4',
    name: 'Maria Santos',
    email: 'maria@example.com',
    unit: 'Apt 404',
    joinDate: '2024-05-02',
    status: 'active',
  },
  {
    id: '5',
    name: 'Eric Cruz',
    email: 'eric@example.com',
    unit: 'Apt 505',
    joinDate: '2024-06-08',
    status: 'active',
  },
];

type DashboardState = {
  status: 'pending' | 'authorized' | 'redirect';
  adminUser?: AdminUser;
  households: Household[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    status: 'pending',
    households: defaultHouseholds,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const authToken = window.localStorage.getItem('authToken');
    const userStr = window.localStorage.getItem('adminUser');
    const savedHouseholds = window.localStorage.getItem('households');

    if (!authToken || !userStr) {
      setDashboardState({ status: 'redirect', households: defaultHouseholds });
      return;
    }

    try {
      const user = JSON.parse(userStr) as AdminUser;
      const storedHouseholds = savedHouseholds ? (JSON.parse(savedHouseholds) as Household[]) : defaultHouseholds;
      setDashboardState({ status: 'authorized', adminUser: user, households: storedHouseholds });
    } catch {
      setDashboardState({ status: 'redirect', households: defaultHouseholds });
    }
  }, []);

  useEffect(() => {
    if (dashboardState.status === 'redirect') {
      router.push('/login');
    }
  }, [dashboardState.status, router]);

  if (dashboardState.status !== 'authorized') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
        <div className="text-center">
          <p className="text-lg text-gray-600">Redirecting to login...</p>
        </div>
      </main>
    );
  }

  const visibleHouseholds = dashboardState.households.filter((household) => household.status !== 'archived');
  const totalHouseholds = visibleHouseholds.length;
  const activeHouseholds = visibleHouseholds.filter((household) => household.status === 'active').length;
  const inactiveHouseholds = visibleHouseholds.filter((household) => household.status === 'inactive').length;
  const archivedHouseholds = dashboardState.households.filter((household) => household.status === 'archived').length;
  const recentHouseholds = visibleHouseholds.slice(0, 5);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-[30px] border border-green-100 bg-gradient-to-br from-green-700 via-emerald-700 to-green-600 p-7 text-white shadow-[0_20px_60px_rgba(22,101,52,0.16)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-green-100">Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {dashboardState.adminUser?.name ?? 'Admin User'}
              </h1>
              <p className="mt-3 text-sm leading-7 text-green-50/90 sm:text-base">
                A simple view of household activity, collection progress, and the daily status of your barangay operations.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/households"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-green-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-green-50"
              >
                Manage Households
              </Link>
              <Link
                href="/reports"
                className="inline-flex items-center justify-center rounded-2xl border border-white/40 bg-green-700/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700/40"
              >
                View Reports
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-[24px] border border-green-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Households</p>
                <p className="mt-3 text-4xl font-semibold text-gray-900">{totalHouseholds}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1v-9.5Z" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">All registered households in the system.</p>
          </div>

          <div className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Active</p>
                <p className="mt-3 text-4xl font-semibold text-emerald-700">{activeHouseholds}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">Households currently marked active.</p>
          </div>

          <div className="rounded-[24px] border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Inactive</p>
                <p className="mt-3 text-4xl font-semibold text-amber-700">{inactiveHouseholds}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">Households archived or inactive.</p>
          </div>

          <div className="rounded-[24px] border border-green-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Archived Households</p>
                <p className="mt-3 text-4xl font-semibold text-gray-900">{archivedHouseholds}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h16M4 19h16" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12M6 15h12" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">Households currently archived in the system.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-[28px] border border-green-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Recent Household Activity</h2>
                <p className="text-sm text-gray-500">Latest households added to the registry.</p>
              </div>
              <div className="text-sm text-gray-500">Showing {recentHouseholds.length} of {totalHouseholds}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm text-gray-600">
                <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-[0.2em] text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Household</th>
                    <th className="px-4 py-3">Purok</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHouseholds.map((household, index) => (
                    <tr key={household.id} className={index % 2 === 0 ? 'bg-white' : 'bg-green-50/40'}>
                      <td className="px-4 py-4 font-semibold text-gray-900">{household.name}</td>
                      <td className="px-4 py-4">{household.unit}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            household.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {household.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">{new Date(household.joinDate).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <Link
                          href="/households"
                          className="inline-flex items-center rounded-full border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[28px] border border-green-100 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Operational Insights</h2>
              <p className="text-sm text-gray-500">Quick view of system health and priorities.</p>
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                  <span>Daily collection target</span>
                  <span className="font-semibold text-gray-900">78%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full w-[78%] rounded-full bg-green-600"></div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
                  <span>Recycling participation</span>
                  <span className="font-semibold text-gray-900">62%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full w-[62%] rounded-full bg-emerald-500"></div>
                </div>
              </div>

              <div className="rounded-[22px] border border-rose-100 bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-rose-800">Pending alerts</p>
                    <p className="mt-1 text-sm text-rose-700">Two pending reports require follow-up from the collection team.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
