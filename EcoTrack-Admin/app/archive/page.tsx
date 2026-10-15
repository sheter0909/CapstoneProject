'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import { adminApi } from '@/lib/api';

interface Household {
  id: string;
  dbId: string;
  name: string;
  email: string;
  unit: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  previousStatus?: 'active' | 'inactive' | 'archived';
}

interface GarbageCollector {
  id: string;
  dbId: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
  previousStatus?: 'active' | 'inactive' | 'archived';
}

interface ArchivedHouseholdRow {
  id: string;
  householdId: string;
  fullName: string;
  address?: string | null;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
}

interface ArchivedCollectorRow {
  id: string;
  collectorId: string;
  fullName: string;
  contactNumber?: string | null;
  assignedArea: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'archived';
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
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [collectors, setCollectors] = useState<GarbageCollector[]>([]);
  const [totalHouseholds, setTotalHouseholds] = useState(0);
  const [totalCollectors, setTotalCollectors] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('households');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadArchive = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
    });
    const query = `?${params.toString()}`;

    if (activeTab === 'households') {
      adminApi.archivedHouseholds(query)
        .then((result) => {
          setTotalHouseholds(result.total ?? 0);
          setHouseholds(
            ((result.items ?? []) as ArchivedHouseholdRow[]).map((account) => ({
              id: account.householdId,
              dbId: account.id,
              name: account.fullName,
              email: account.householdId,
              unit: account.address ?? '',
              joinDate: account.joinDate,
              status: account.status,
            }))
          );
        })
        .catch(() => {
          setHouseholds([]);
          setTotalHouseholds(0);
        })
        .finally(() => setIsLoading(false));
    } else {
      adminApi.archivedCollectors(query)
        .then((result) => {
          setTotalCollectors(result.total ?? 0);
          setCollectors(
            ((result.items ?? []) as ArchivedCollectorRow[]).map((account) => ({
              id: account.collectorId,
              dbId: account.id,
              name: account.fullName,
              email: '',
              phone: account.contactNumber ?? '',
              zone: account.assignedArea,
              joinDate: account.joinDate,
              status: account.status,
            }))
          );
        })
        .catch(() => {
          setCollectors([]);
          setTotalCollectors(0);
        })
        .finally(() => setIsLoading(false));
    }
  }, [activeTab, page, pageSize, debouncedQuery]);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');

    if (!authToken || !userStr) {
      router.push('/login');
      return;
    }

    try {
      JSON.parse(userStr);
    } catch {
      router.push('/login');
      return;
    }

    loadArchive();
  }, [router, loadArchive]);

  const currentItems = activeTab === 'households' ? households : collectors;
  const currentTotal = activeTab === 'households' ? totalHouseholds : totalCollectors;

  const handleRestore = async (id: string) => {
    try {
      if (activeTab === 'households') {
        const target = households.find((household) => household.id === id);
        if (!target) return;
        await adminApi.unarchiveHousehold(target.dbId);
        setToastMessage('Household account restored successfully.');
      } else {
        const target = collectors.find((collector) => collector.id === id);
        if (!target) return;
        await adminApi.unarchiveCollector(target.dbId);
        setToastMessage('Garbage collector account restored successfully.');
      }
      loadArchive();
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : 'Unable to restore account.');
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
      <div className="mx-auto max-w-7xl 2xl:max-w-[1440px] px-4 py-8">
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
                {tab === 'households' ? `Households (${totalHouseholds})` : `Collectors (${totalCollectors})`}
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
              <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">ID</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">Name</th>
                  {activeTab === 'collectors' && <th className="whitespace-nowrap px-4 py-3 sm:px-6">Zone</th>}
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">Joined</th>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={activeTab === 'collectors' ? 6 : 5}>
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
