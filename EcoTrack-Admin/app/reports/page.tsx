'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, type CollectionAdminRecord } from '../../lib/api';
import type {
  ReportData,
  WeeklyCollectionRow,
  WasteDistributionRow,
  MonthlyPerformanceRow,
  DetailedExportKind,
  CollectionExportRow,
  ComplianceExportRow,
} from '../../lib/reportExport';

interface SummaryPayload {
  totalHouseholds: number;
  activeCollectors: number;
  wasteCollected: number;
  recycledRate: number;
}

interface PeriodPayload {
  _id: string;
  totalKg: number;
}

interface DistributionPayload {
  _id: string;
  weightKg: number;
}

function toWeekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

function toMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toWasteTypeLabel(raw: string): string {
  if (raw === 'biodegradable') return 'Biodegradable';
  if (raw === 'recyclable') return 'Recyclable';
  if (raw === 'non_biodegradable' || raw === 'non-biodegradable') return 'Non-biodegradable';
  if (raw === 'mixed') return 'Mixed (Not Segregated)';
  return raw;
}

function computePercentDelta(monthly: PeriodPayload[]): string {
  const sorted = [...monthly].sort((a, b) => a._id.localeCompare(b._id));
  if (sorted.length < 2) return '';
  const latest = Number(sorted[sorted.length - 1].totalKg);
  const previous = Number(sorted[sorted.length - 2].totalKg);
  if (!previous) return '';
  const change = ((latest - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}% this month`;
}

function buildReportData(
  summary: SummaryPayload,
  weekly: PeriodPayload[],
  distribution: DistributionPayload[],
  monthly: PeriodPayload[],
): ReportData {
  const recentDays = [...weekly]
    .sort((a, b) => a._id.localeCompare(b._id))
    .slice(-7)
    .map(({ _id, totalKg }) => ({ day: toWeekdayLabel(_id), date: _id, kg: Number(totalKg) }));

  const totalWeight = distribution.reduce((sum, entry) => sum + Number(entry.weightKg), 0);
  const wasteTypes = distribution
    .map(({ _id, weightKg }) => ({
      type: toWasteTypeLabel(_id),
      percent: totalWeight ? Math.round((Number(weightKg) / totalWeight) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.percent - a.percent);

  const monthlyRows = [...monthly]
    .sort((a, b) => a._id.localeCompare(b._id))
    .slice(-12)
    .reverse()
    .map(({ _id, totalKg }) => ({
      month: toMonthLabel(_id),
      totalKg: Number(totalKg),
      householdsActive: '—',
      recycledRate: '—',
      trend: '—',
    }));

  const wasteDelta = computePercentDelta(monthly);

  return {
    summary: {
      totalHouseholds: summary.totalHouseholds,
      householdsDelta: '',
      activeCollectors: summary.activeCollectors,
      collectorsDelta: '',
      wasteCollectedKg: summary.wasteCollected,
      wasteDelta,
      recycledRate: Math.round(summary.recycledRate * 10) / 10,
      recycledDelta: '',
    },
    weeklyCollection: recentDays,
    wasteDistribution: wasteTypes,
    monthlyPerformance: monthlyRows,
  };
}

function formatKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K`;
  return kg.toLocaleString();
}

function weekProgressPercent(kg: number, maxKg: number): number {
  return Math.max(8, Math.min(100, Math.round((kg / Math.max(maxKg, 1)) * 100)));
}

type ReportPeriod = 'weekly' | 'monthly' | 'yearly';

const EXPORT_OPTIONS: { value: DetailedExportKind; label: string }[] = [
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'yearly', label: 'Yearly Report' },
  { value: 'households', label: 'Household Waste Records' },
  { value: 'collections', label: 'Waste Collection Records' },
  { value: 'segregation', label: 'Segregation Records' },
  { value: 'compliance', label: 'Compliance Summary' },
];

function startOfWeek(dateStr: string): Date {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

type FetchStatus = 'loading' | 'ok' | 'error';

export default function ReportsPage() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading');
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [selectedWeek, setSelectedWeek] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [exportKind, setExportKind] = useState<DetailedExportKind>('weekly');

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');

    if (!authToken || !userStr) {
      router.push('/login');
    } else {
      try {
        JSON.parse(userStr);
      } catch {
        router.push('/login');
      }
    }
  }, [router]);

  const loadReports = useCallback(async () => {
    setFetchStatus('loading');
    const [summaryRes, weeklyRes, distributionRes, monthlyRes] = await Promise.allSettled([
      adminApi.reportSummary(),
      adminApi.reportWeeklyCollection(),
      adminApi.reportWasteTypeDistribution(),
      adminApi.reportMonthlyPerformance(),
    ]);

    const allOk = [summaryRes, weeklyRes, distributionRes, monthlyRes].every((r) => r.status === 'fulfilled');
    if (!allOk) {
      setFetchStatus('error');
      return;
    }

    const summary = (summaryRes as PromiseFulfilledResult<{ totalHouseholds: number; activeCollectors: number; wasteCollected: number; recycledRate: number }>).value;
    const weekly = (weeklyRes as PromiseFulfilledResult<{ _id: string; totalKg: number }[]>).value;
    const distribution = (distributionRes as PromiseFulfilledResult<{ _id: string; weightKg: number }[]>).value;
    const monthly = (monthlyRes as PromiseFulfilledResult<{ _id: string; totalKg: number }[]>).value;

    setReportData(buildReportData(summary, weekly, distribution, monthly));
    setFetchStatus('ok');
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const periodLabel =
    period === 'weekly'
      ? `Week of ${startOfWeek(selectedWeek).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : period === 'monthly'
        ? new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : `Year ${selectedYear}`;

  const filteredWeekly: WeeklyCollectionRow[] = (reportData?.weeklyCollection ?? []).filter((row) => {
    if (!row.date) return period === 'weekly';
    if (period === 'weekly') {
      const start = startOfWeek(selectedWeek).getTime();
      const day = new Date(`${row.date}T00:00:00`).getTime();
      return day >= start && day < start + 7 * 24 * 60 * 60 * 1000;
    }
    if (period === 'monthly') return row.date.slice(0, 7) === selectedMonth;
    return row.date.slice(0, 4) === String(selectedYear);
  });

  const filteredMonthly: MonthlyPerformanceRow[] = (reportData?.monthlyPerformance ?? []).filter((row) => {
    const parsed = new Date(`${row.month} 01`);
    if (isNaN(parsed.getTime())) return true;
    if (period === 'monthly') {
      return parsed.toISOString().slice(0, 7) === selectedMonth;
    }
    if (period === 'yearly') {
      return parsed.getFullYear() === selectedYear;
    }
    return true;
  });

  const toCollectionRows = (entries: CollectionAdminRecord[]): CollectionExportRow[] =>
    entries.map((entry) => ({
      householdId: entry.householdId,
      householdName: entry.householdName,
      purok: entry.householdPurok,
      collectionDate: entry.timestamp,
      weightKg: Number(entry.weightKg),
      segregationStatus: entry.segregationStatus === 'segregated' ? 'Segregated' : 'Not segregated',
      wasteType: toWasteTypeLabel(entry.wasteType),
      collector: entry.collectorName,
      remarks: entry.editedAt ? 'Edited after submission' : '',
    }));

  const toComplianceRows = (entries: CollectionAdminRecord[]): ComplianceExportRow[] => {
    const byHousehold = new Map<string, CollectionAdminRecord[]>();
    for (const entry of entries) {
      const list = byHousehold.get(entry.householdId) ?? [];
      list.push(entry);
      byHousehold.set(entry.householdId, list);
    }
    return [...byHousehold.entries()].map(([householdId, list]) => {
      const segregated = list.filter((entry) => entry.segregationStatus === 'segregated').length;
      const latest = list
        .map((entry) => new Date(entry.timestamp).getTime())
        .sort((a, b) => b - a)[0];
      return {
        householdId,
        householdName: list[0]?.householdName ?? householdId,
        purok: list[0]?.householdPurok ?? '',
        totalCollections: list.length,
        segregatedCount: segregated,
        complianceRate: `${Math.round((segregated / list.length) * 100)}%`,
        lastCollection: Number.isFinite(latest)
          ? new Date(latest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—',
      };
    });
  };

  const fetchEntriesForPeriod = async (): Promise<CollectionAdminRecord[]> => {
    let from = '';
    let to = '';
    if (period === 'weekly') {
      const start = startOfWeek(selectedWeek);
      from = start.toISOString();
      to = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === 'monthly') {
      const [year, month] = selectedMonth.split('-').map(Number);
      from = new Date(year, month - 1, 1).toISOString();
      to = new Date(year, month, 1).toISOString();
    } else {
      from = new Date(selectedYear, 0, 1).toISOString();
      to = new Date(selectedYear + 1, 0, 1).toISOString();
    }
    const baseParams = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const allItems: CollectionAdminRecord[] = [];
    let page = 1;
    const MAX_EXPORT_PAGES = 50;
    for (;;) {
      const result = await adminApi.allCollections(`?limit=100&page=${page}&${baseParams}`);
      const items = result.items ?? [];
      allItems.push(...items);
      const totalPages = result.totalPages ?? 1;
      if (page >= totalPages || items.length === 0 || page >= MAX_EXPORT_PAGES) break;
      page += 1;
    }
    return allItems;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      const { exportDetailedReport } = await import('../../lib/reportExport');
      const entries = await fetchEntriesForPeriod();
      exportDetailedReport(exportKind, periodLabel, toCollectionRows(entries), toComplianceRows(entries));
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const summary = reportData?.summary ?? null;
  const wasteDistribution: WasteDistributionRow[] = reportData?.wasteDistribution ?? [];
  const weeklyCollection = filteredWeekly;
  const monthlyPerformance = filteredMonthly;
  const weeklyMaxKg = Math.max(...weeklyCollection.map((r) => r.kg), 1);

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Reports & Analysis</h2>
            <p className="text-gray-600">View comprehensive waste management analytics and reports</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <label className="text-sm font-semibold text-gray-700">
              Export data
              <select
                value={exportKind}
                onChange={(e) => setExportKind(e.target.value as DetailedExportKind)}
                className="ml-2 rounded-xl border border-green-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:border-green-500"
              >
                {EXPORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={handleExport}
              disabled={isExporting || fetchStatus !== 'ok'}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? 'Preparing...' : 'Export to Excel'}
            </button>
          </div>
        </div>

        {fetchStatus === 'loading' && (
          <div className="mb-6 rounded-2xl border border-green-100 bg-white/80 px-5 py-4 text-sm font-medium text-gray-600 flex items-center gap-3">
            <svg className="h-4 w-4 animate-spin text-green-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Connecting to server… this may take a few seconds on first load.
          </div>
        )}

        {fetchStatus === 'error' && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 flex items-center justify-between gap-4">
            <span>Could not load reports — the backend is unreachable. No figures are shown until live data loads.</span>
            <button
              onClick={() => void loadReports()}
              className="shrink-0 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {exportError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {exportError}
          </div>
        )}

        {/* Period filter */}
        <div className="mb-8 rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
          <div className="flex flex-wrap items-center gap-3">
            {(['weekly', 'monthly', 'yearly'] as ReportPeriod[]).map((option) => (
              <button
                key={option}
                onClick={() => setPeriod(option)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${
                  period === option
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option}
              </button>
            ))}
            <span className="ml-1 text-sm font-medium text-gray-500">{periodLabel}</span>
            <div className="ml-auto flex items-center gap-2">
              {period === 'weekly' && (
                <input
                  type="date"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-green-500"
                  aria-label="Select week"
                />
              )}
              {period === 'monthly' && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-green-500"
                  aria-label="Select month"
                />
              )}
              {period === 'yearly' && (
                <input
                  type="number"
                  value={selectedYear}
                  min={2020}
                  max={2100}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-28 rounded-xl border border-green-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-green-500"
                  aria-label="Select year"
                />
              )}
            </div>
          </div>
        </div>

        {fetchStatus === 'ok' && summary && (
          <>
            {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="text-3xl font-bold text-green-600 mb-2">{summary.totalHouseholds.toLocaleString()}</div>
            <p className="text-base text-gray-700 font-medium">Total Households</p>
            {summary.householdsDelta && <p className="text-sm text-green-600">{summary.householdsDelta}</p>}
          </div>
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="text-3xl font-bold text-green-600 mb-2">{summary.activeCollectors.toLocaleString()}</div>
            <p className="text-base text-gray-700 font-medium">Active Collectors</p>
            {summary.collectorsDelta && <p className="text-sm text-green-600">{summary.collectorsDelta}</p>}
          </div>
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="text-3xl font-bold text-green-600 mb-2">{formatKg(summary.wasteCollectedKg)}</div>
            <p className="text-base text-gray-700 font-medium">Waste Collected (kg)</p>
            {summary.wasteDelta && <p className="text-sm text-green-600">{summary.wasteDelta}</p>}
          </div>
          <div className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-[0_20px_60px_rgba(20,83,45,0.08)]">
            <div className="text-3xl font-bold text-green-600 mb-2">{summary.recycledRate}%</div>
            <p className="text-base text-gray-700 font-medium">Recycled Rate</p>
            {summary.recycledDelta && <p className="text-sm text-green-600">{summary.recycledDelta}</p>}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Waste Collection Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Weekly Waste Collection</h3>
            <div className="space-y-4">
              {weeklyCollection.length === 0 && (
                <p className="text-sm text-gray-500">No collection data available yet.</p>
              )}
              {weeklyCollection.map((row) => (
                <div key={row.date ?? row.day}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">{row.day}</span>
                    <span className="text-sm font-semibold text-gray-800">{row.kg.toLocaleString()} kg</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${weekProgressPercent(row.kg, weeklyMaxKg)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Waste Type Distribution */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Waste Type Distribution</h3>
            <div className="space-y-4">
              {wasteDistribution.length === 0 && (
                <p className="text-sm text-gray-500">No waste data available yet.</p>
              )}
              {wasteDistribution.map((row) => (
                <div key={row.type}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600 font-medium">{row.type}</span>
                    <span className="text-sm font-semibold text-gray-800">{row.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full" style={{ width: `${Math.min(100, Math.max(row.percent, 2))}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Monthly Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Month</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Collected (kg)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Households Active</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Recycled Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Trend</th>
                </tr>
              </thead>
              <tbody>
                {monthlyPerformance.length === 0 && (
                  <tr>
                    <td className="px-6 py-4 text-sm text-gray-500" colSpan={5}>No monthly data available yet.</td>
                  </tr>
                )}
                {monthlyPerformance.map((row) => (
                  <tr key={row.month} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">{row.month}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{row.totalKg.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{row.householdsActive}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{row.recycledRate}</td>
                    <td className="px-6 py-4 text-sm">
                      {row.trend !== '—' ? <span className="text-green-600 font-semibold">{row.trend}</span> : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </main>
  );
}