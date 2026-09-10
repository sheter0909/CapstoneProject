'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '../../lib/api';
import { EmptyState, LoadingState, StatCard, StatusBadge } from '../../components/ui';

interface AdminUser {
  email: string;
  name: string;
}

interface RecentHousehold {
  id: string;
  name: string;
  purok: string;
  joinDate: string;
  status: string;
}

interface DashboardMetrics {
  totalHouseholds: number;
  activeHouseholds: number;
  inactiveHouseholds: number;
  archivedHouseholds: number;
  activeCollectors: number;
  wasteCollectedKg: number;
  recycledRate: number;
  pendingAlerts: number;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentHouseholds, setRecentHouseholds] = useState<RecentHousehold[]>([]);

  useEffect(() => {
    const authToken = window.localStorage.getItem('authToken');
    const userStr = window.localStorage.getItem('adminUser');

    if (!authToken || !userStr) {
      router.push('/login');
      return;
    }

    try {
      setAdminUser(JSON.parse(userStr) as AdminUser);
    } catch {
      router.push('/login');
      return;
    }
    setAuthChecked(true);

    Promise.all([
      adminApi.dashboardStats() as Promise<{ totalHouseholds: number; activeHouseholds: number; inactiveHouseholds: number; archivedHouseholds: number; pendingAlerts: number }>,
      adminApi.reportSummary(),
      adminApi.households('?limit=5') as Promise<{ items?: { id: string; fullName: string; purok: string; joinDate: string; status: string }[] }>,
    ])
      .then(([stats, summary, households]) => {
        setMetrics({
          totalHouseholds: stats.totalHouseholds,
          activeHouseholds: stats.activeHouseholds,
          inactiveHouseholds: stats.inactiveHouseholds,
          archivedHouseholds: stats.archivedHouseholds,
          activeCollectors: summary.activeCollectors,
          wasteCollectedKg: Math.round(summary.wasteCollected * 100) / 100,
          recycledRate: Math.round(summary.recycledRate * 10) / 10,
          pendingAlerts: stats.pendingAlerts,
        });
        setRecentHouseholds(
          (households.items ?? []).map((account) => ({
            id: account.id,
            name: account.fullName,
            purok: account.purok,
            joinDate: account.joinDate,
            status: account.status,
          })),
        );
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
        <div className="text-center">
          <p className="text-lg text-gray-600">Redirecting to login...</p>
        </div>
      </main>
    );
  }

  const greeting = greetingForHour(new Date().getHours());

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f7fdf8_0%,#eef9ef_100%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-[30px] border border-green-100 bg-green-700 p-7 text-white shadow-[0_20px_60px_rgba(22,101,52,0.16)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-green-100">Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {greeting}, {adminUser?.name ?? 'Admin'}!
              </h1>
              <p className="mt-3 text-base leading-7 text-green-50/90">
                Here&apos;s what&apos;s happening with EcoTrack today — household activity, collection progress, and your barangay operations at a glance.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/households"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
              >
                Manage Households
              </Link>
              <Link
                href="/reports"
                className="inline-flex items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                View Reports
              </Link>
            </div>
          </div>
        </section>

        {isLoading ? (
          <LoadingState label="Loading dashboard..." />
        ) : loadError ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-base font-semibold text-red-700">
            {loadError}
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key statistics">
              <StatCard
                label="Total Households"
                value={String(metrics?.totalHouseholds ?? 0)}
                hint="All registered households in the system."
                tone="green"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1v-9.5Z" />
                  </svg>
                }
              />
              <StatCard
                label="Active Collectors"
                value={String(metrics?.activeCollectors ?? 0)}
                hint="Collectors currently on duty."
                tone="emerald"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                }
              />
              <StatCard
                label="Waste Collected (kg)"
                value={(metrics?.wasteCollectedKg ?? 0).toLocaleString()}
                hint="Total across all collections."
                tone="blue"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19V9M12 19V5M19 19v-7" />
                  </svg>
                }
              />
              <StatCard
                label="Recycled Rate"
                value={`${metrics?.recycledRate ?? 0}%`}
                hint="Share of recyclable waste."
                tone="amber"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 0 0-14-4M4 15a8 8 0 0 0 14 4" />
                  </svg>
                }
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-[28px] border border-green-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Recent Households</h2>
                    <p className="text-base text-gray-500">Latest households added to the registry.</p>
                  </div>
                  <div className="text-sm text-gray-500">Showing {recentHouseholds.length}</div>
                </div>

                {recentHouseholds.length === 0 ? (
                  <EmptyState icon="🏘️" title="No households yet" hint="Registered households will appear here." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-gray-600">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.12em] text-gray-500">
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
                          <tr key={household.id} className={`transition hover:bg-green-50/60 ${index % 2 === 0 ? 'bg-white' : 'bg-green-50/40'}`}>
                            <td className="px-4 py-4 text-base font-semibold text-gray-900">{household.name}</td>
                            <td className="px-4 py-4 text-base">{household.purok}</td>
                            <td className="px-4 py-4">
                              <StatusBadge tone={household.status === 'active' ? 'green' : household.status === 'inactive' ? 'amber' : 'gray'}>
                                {household.status}
                              </StatusBadge>
                            </td>
                            <td className="px-4 py-4 text-base">{new Date(household.joinDate).toLocaleDateString()}</td>
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
                )}
              </div>

              <div className="rounded-[28px] border border-green-100 bg-white p-6 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Operational Insights</h2>
                  <p className="text-base text-gray-500">System health and priorities.</p>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[22px] border border-green-100 bg-green-50/60 p-4">
                    <p className="text-base font-semibold text-gray-800">Household status</p>
                    <p className="mt-1 text-base text-gray-600">
                      {metrics?.activeHouseholds ?? 0} active • {metrics?.inactiveHouseholds ?? 0} inactive • {metrics?.archivedHouseholds ?? 0} archived
                    </p>
                  </div>

                  {(metrics?.pendingAlerts ?? 0) > 0 ? (
                    <div className="rounded-[22px] border border-rose-100 bg-rose-50 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-base font-semibold text-rose-800">Pending alerts</p>
                          <p className="mt-1 text-base text-rose-700">
                            {metrics?.pendingAlerts} item{metrics?.pendingAlerts === 1 ? '' : 's'} need{metrics?.pendingAlerts === 1 ? 's' : ''} follow-up from the collection team.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-green-100 bg-green-50/60 p-4">
                      <p className="text-base font-semibold text-green-800">All clear ✓</p>
                      <p className="mt-1 text-base text-green-700">No pending alerts at the moment.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
