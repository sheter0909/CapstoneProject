'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '../../lib/api';
import type { ReportData, SummaryRow, WeeklyCollectionRow, WasteDistributionRow, MonthlyPerformanceRow } from '../../lib/reportExport';

const INITIAL_SUMMARY: SummaryRow = {
  totalHouseholds: 156,
  householdsDelta: '+12 this month',
  activeCollectors: 28,
  collectorsDelta: '+3 this month',
  wasteCollectedKg: 2400,
  wasteDelta: '+18% this month',
  recycledRate: 94,
  recycledDelta: '+2% this month',
};

const INITIAL_WEEKLY: WeeklyCollectionRow[] = [
  { day: 'Monday', kg: 240 },
  { day: 'Tuesday', kg: 310 },
  { day: 'Wednesday', kg: 185 },
  { day: 'Thursday', kg: 275 },
  { day: 'Friday', kg: 225 },
];

const INITIAL_DISTRIBUTION: WasteDistributionRow[] = [
  { type: 'Recyclable', percent: 45 },
  { type: 'Organic', percent: 30 },
  { type: 'Plastic', percent: 15 },
  { type: 'Other', percent: 10 },
];

const INITIAL_MONTHLY: MonthlyPerformanceRow[] = [
  { month: 'July 2024', totalKg: 2240, householdsActive: 144, recycledRate: '92%', trend: '↑ 8%' },
  { month: 'June 2024', totalKg: 2075, householdsActive: 138, recycledRate: '88%', trend: '↑ 5%' },
  { month: 'May 2024', totalKg: 1976, householdsActive: 132, recycledRate: '85%', trend: '↑ 12%' },
];

const INITIAL_REPORT: ReportData = {
  summary: INITIAL_SUMMARY,
  weeklyCollection: INITIAL_WEEKLY,
  wasteDistribution: INITIAL_DISTRIBUTION,
  monthlyPerformance: INITIAL_MONTHLY,
};

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
  return raw;
}

function computeWasteDelta(monthly: PeriodPayload[], fallback: string): string {
  const sorted = [...monthly].sort((a, b) => a._id.localeCompare(b._id));
  if (sorted.length < 2) return fallback;
  const latest = Number(sorted[sorted.length - 1].totalKg);
  const previous = Number(sorted[sorted.length - 2].totalKg);
  if (!previous) return fallback;
  const change = ((latest - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}% this month`;
}

function buildReportData(
  summary: SummaryPayload,
  weekly: PeriodPayload[],
  distribution: DistributionPayload[],
  monthly: PeriodPayload[],
  fallback: ReportData,
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
    .map(({ _id, totalKg }) => {
      const label = toMonthLabel(_id);
      const prev = fallback.monthlyPerformance.find((row) => row.month === label);
      return {
        month: label,
        totalKg: Number(totalKg),
        householdsActive: prev?.householdsActive ?? '—',
        recycledRate: prev?.recycledRate ?? '—',
        trend: prev?.trend ?? '—',
      };
    });

  return {
    summary: {
      totalHouseholds: summary.totalHouseholds,
      householdsDelta: fallback.summary.householdsDelta,
      activeCollectors: summary.activeCollectors,
      collectorsDelta: fallback.summary.collectorsDelta,
      wasteCollectedKg: summary.wasteCollected,
      wasteDelta: computeWasteDelta(monthly, fallback.summary.wasteDelta),
      recycledRate: Math.round(summary.recycledRate * 10) / 10,
      recycledDelta: fallback.summary.recycledDelta,
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

function weekProgressPercent(kg: number): number {
  const max = Math.max(...INITIAL_WEEKLY.map((row) => row.kg), kg, 1);
  return Math.max(8, Math.min(100, Math.round((kg / max) * 100)));
}

export default function ReportsPage() {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [reportData, setReportData] = useState<ReportData>(INITIAL_REPORT);

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

  useEffect(() => {
    Promise.all([
      adminApi.reportSummary(),
      adminApi.reportWeeklyCollection(),
      adminApi.reportWasteTypeDistribution(),
      adminApi.reportMonthlyPerformance(),
    ])
      .then(([summary, weekly, distribution, monthly]) => {
        setReportData((current) => buildReportData(summary, weekly, distribution, monthly, current));
      })
      .catch(() => {
        // Keep the current (fallback) data when the backend is unavailable.
      });
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { exportReportToExcel } = await import('../../lib/reportExport');
      exportReportToExcel(reportData);
    } finally {
      setIsExporting(false);
    }
  };

  const { summary, weeklyCollection, wasteDistribution, monthlyPerformance } = reportData;

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Reports & Analysis</h2>
            <p className="text-gray-600">View comprehensive waste management analytics and reports</p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? 'Preparing...' : 'Export to Excel'}
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">{summary.totalHouseholds.toLocaleString()}</div>
            <p className="text-gray-600 font-medium">Total Households</p>
            <p className="text-sm text-green-600">{summary.householdsDelta}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">{summary.activeCollectors.toLocaleString()}</div>
            <p className="text-gray-600 font-medium">Active Collectors</p>
            <p className="text-sm text-green-600">{summary.collectorsDelta}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">{formatKg(summary.wasteCollectedKg)}</div>
            <p className="text-gray-600 font-medium">Waste Collected (kg)</p>
            <p className="text-sm text-green-600">{summary.wasteDelta}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">{summary.recycledRate}%</div>
            <p className="text-gray-600 font-medium">Recycled Rate</p>
            <p className="text-sm text-green-600">{summary.recycledDelta}</p>
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
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${weekProgressPercent(row.kg)}%` }}></div>
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
      </div>
    </main>
  );
}