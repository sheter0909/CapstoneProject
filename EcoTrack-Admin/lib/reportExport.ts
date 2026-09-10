import * as XLSX from 'xlsx';

export interface SummaryRow {
  totalHouseholds: number;
  householdsDelta: string;
  activeCollectors: number;
  collectorsDelta: string;
  wasteCollectedKg: number;
  wasteDelta: string;
  recycledRate: number;
  recycledDelta: string;
}

export interface WeeklyCollectionRow {
  day: string;
  date?: string;
  kg: number;
}

export interface WasteDistributionRow {
  type: string;
  percent: number;
}

export interface MonthlyPerformanceRow {
  month: string;
  totalKg: number;
  householdsActive: number | string;
  recycledRate: string;
  trend: string;
}

export interface ReportData {
  summary: SummaryRow;
  weeklyCollection: WeeklyCollectionRow[];
  wasteDistribution: WasteDistributionRow[];
  monthlyPerformance: MonthlyPerformanceRow[];
}

function setColWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
}

export function exportReportToExcel(data: ReportData): void {
  const wb = XLSX.utils.book_new();
  const generatedAt = new Date().toLocaleString();

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['EcoTrack Report'],
    [`Generated: ${generatedAt}`],
    [],
    ['Metric', 'Value', 'Delta (This Month)'],
    ['Total Households', data.summary.totalHouseholds, data.summary.householdsDelta],
    ['Active Collectors', data.summary.activeCollectors, data.summary.collectorsDelta],
    ['Waste Collected (kg)', data.summary.wasteCollectedKg, data.summary.wasteDelta],
    ['Recycled Rate (%)', data.summary.recycledRate, data.summary.recycledDelta],
  ]);
  setColWidths(summarySheet, [22, 16, 20]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const weeklySheet = XLSX.utils.aoa_to_sheet([
    ['Weekly Waste Collection'],
    [`Generated: ${generatedAt}`],
    [],
    ['Day', 'Date', 'Collected (kg)'],
    ...data.weeklyCollection.map((row) => [row.day, row.date ?? '', row.kg]),
  ]);
  setColWidths(weeklySheet, [14, 14, 16]);
  XLSX.utils.book_append_sheet(wb, weeklySheet, 'Weekly Collection');

  const distributionSheet = XLSX.utils.aoa_to_sheet([
    ['Waste Type Distribution'],
    [`Generated: ${generatedAt}`],
    [],
    ['Waste Type', 'Percentage (%)'],
    ...data.wasteDistribution.map((row) => [row.type, row.percent]),
  ]);
  setColWidths(distributionSheet, [22, 16]);
  XLSX.utils.book_append_sheet(wb, distributionSheet, 'Waste Distribution');

  const monthlySheet = XLSX.utils.aoa_to_sheet([
    ['Monthly Performance'],
    [`Generated: ${generatedAt}`],
    [],
    ['Month', 'Total Collected (kg)', 'Households Active', 'Recycled Rate', 'Trend'],
    ...data.monthlyPerformance.map((row) => [
      row.month,
      row.totalKg,
      row.householdsActive,
      row.recycledRate,
      row.trend,
    ]),
  ]);
  setColWidths(monthlySheet, [14, 20, 18, 16, 12]);
  XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Performance');

  const filename = `ecotrack-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}