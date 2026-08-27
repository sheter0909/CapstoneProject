'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import { addActivity, formatActivityTimestamp } from '@/lib/activity';

interface Household {
  id: string;
  name: string;
  email: string;
  unit: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  previousStatus?: 'active' | 'inactive' | 'archived';
}

interface GarbageCollector {
  id: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  previousStatus?: 'active' | 'inactive' | 'archived';
}

interface AdminUser {
  email: string;
  name: string;
}

const TABS = ['households', 'collectors'] as const;
type TabKey = (typeof TABS)[number];

const statusClass = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-amber-100 text-amber-800',
  archived: 'bg-gray-200 text-gray-700',
};

export default function ArchivePage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [collectors, setCollectors] = useState<GarbageCollector[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('households');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');
    const savedHouseholds = localStorage.getItem('households');
    const savedCollectors = localStorage.getItem('garbageCollectors');

    if (!authToken || !userStr) {
      router.push('/login');
      return;
    }

    try {
      setAdminUser(JSON.parse(userStr));
    } catch {
      router.push('/login');
      return;
    }

    if (savedHouseholds) {
      try {
        setHouseholds(JSON.parse(savedHouseholds) as Household[]);
      } catch {
        setHouseholds([]);
      }
    }

    if (savedCollectors) {
      try {
        setCollectors(JSON.parse(savedCollectors) as GarbageCollector[]);
      } catch {
        setCollectors([]);
      }
    }

    setIsLoading(false);
  }, [router]);

  const archivedHouseholds = useMemo(
    () => households.filter((household) => household.status === 'archived'),
    [households]
  );

  const archivedCollectors = useMemo(
    () => collectors.filter((collector) => collector.status === 'archived'),
    [collectors]
  );

  const filteredHouseholds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return archivedHouseholds.filter((household) =>
      !query ||
      household.name.toLowerCase().includes(query) ||
      household.email.toLowerCase().includes(query) ||
      household.unit.toLowerCase().includes(query)
    );
  }, [archivedHouseholds, searchQuery]);

  const filteredCollectors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return archivedCollectors.filter((collector) =>
      !query ||
      collector.name.toLowerCase().includes(query) ||
      collector.email.toLowerCase().includes(query) ||
      collector.zone.toLowerCase().includes(query) ||
      collector.phone.toLowerCase().includes(query)
    );
  }, [archivedCollectors, searchQuery]);

  const pagedHouseholds = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredHouseholds.slice(start, start + pageSize);
  }, [filteredHouseholds, page, pageSize]);

  const pagedCollectors = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCollectors.slice(start, start + pageSize);
  }, [filteredCollectors, page, pageSize]);

  const currentItems = activeTab === 'households' ? pagedHouseholds : pagedCollectors;
  const currentTotal = activeTab === 'households' ? filteredHouseholds.length : filteredCollectors.length;

  const handleRestore = (id: string) => {
    if (activeTab === 'households') {
      const updated = households.map((household) =>
        household.id === id
          ? {
              ...household,
              status: household.previousStatus === 'active' || household.previousStatus === 'inactive' ? household.previousStatus : 'active',
              previousStatus: household.previousStatus,
            }
          : household
      );
      setHouseholds(updated);
      localStorage.setItem('households', JSON.stringify(updated));
      addActivity(
        `${adminUser?.name || 'Admin User'} restored household ${households.find((h) => h.id === id)?.name ?? id} — ${formatActivityTimestamp(new Date())}`,
        adminUser?.name || 'Admin User',
        'Account Update'
      );
      setToastMessage('Household account restored successfully.');
    } else {
      const updated = collectors.map((collector) =>
        collector.id === id
          ? {
              ...collector,
              status: collector.previousStatus === 'active' || collector.previousStatus === 'inactive' ? collector.previousStatus : 'active',
              previousStatus: collector.previousStatus,
            }
          : collector
      );
      setCollectors(updated);
      localStorage.setItem('garbageCollectors', JSON.stringify(updated));
      addActivity(
        `${adminUser?.name || 'Admin User'} restored garbage collector ${collectors.find((c) => c.id === id)?.name ?? id} — ${formatActivityTimestamp(new Date())}`,
        adminUser?.name || 'Admin User',
        'Account Update'
      );
      setToastMessage('Garbage collector account restored successfully.');
    }

    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading archived accounts...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-700">Archive Center</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Archived Accounts</h1>
            <p className="mt-2 text-gray-600">Review accounts that were archived and restore them when needed.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab === 'households' ? `Households (${archivedHouseholds.length})` : `Collectors (${archivedCollectors.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-80">
            <label htmlFor="archive-search" className="sr-only">Search archived accounts</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M10.5 3a7.5 7.5 0 015.94 12.06l4.75 4.75a1 1 0 01-1.42 1.42l-4.75-4.75A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" />
                </svg>
              </span>
              <input
                id="archive-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search archived households or collectors"
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-3 pl-12 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-400 focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Showing</p>
            <p className="text-lg font-semibold text-gray-900">{currentTotal} archived records</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-green-100 bg-white shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm text-gray-600">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-[0.2em] text-gray-500">
                <tr>
                  <th className="px-4 py-3 sm:px-6">ID</th>
                  <th className="px-4 py-3 sm:px-6">Name</th>
                  {activeTab === 'collectors' && <th className="px-4 py-3 sm:px-6">Zone</th>}
                  <th className="px-4 py-3 sm:px-6">Email</th>
                  <th className="px-4 py-3 sm:px-6">Status</th>
                  <th className="px-4 py-3 sm:px-6">Joined</th>
                  <th className="px-4 py-3 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={activeTab === 'collectors' ? 7 : 6}>
                      No archived {activeTab === 'households' ? 'households' : 'collectors'} found.
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-green-50/40'}>
                      <td className="px-4 py-4 text-sm text-gray-700 sm:px-6">{item.id}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900 sm:px-6">{item.name}</td>
                      {activeTab === 'collectors' && (
                        <td className="px-4 py-4 text-sm text-gray-800 sm:px-6">{(item as GarbageCollector).zone}</td>
                      )}
                      <td className="px-4 py-4 text-sm text-gray-700 sm:px-6">{item.email}</td>
                      <td className="px-4 py-4 sm:px-6">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-800 sm:px-6">{new Date(item.joinDate).toLocaleDateString()}</td>
                      <td className="px-4 py-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => handleRestore(item.id)}
                          className="inline-flex items-center rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 bg-white px-4 py-5 sm:px-6">
            <Pagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={currentTotal}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </div>

        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50 rounded-2xl border border-green-200 bg-white px-5 py-4 shadow-xl">
            <p className="text-sm font-semibold text-gray-900">{toastMessage}</p>
          </div>
        )}
      </div>
    </main>
  );
}
