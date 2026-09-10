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

export type DetailedExportKind =
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'households'
  | 'collections'
  | 'segregation'
  | 'compliance';

export interface CollectionExportRow {
  householdId: string;
  householdName: string;
  purok: string;
  collectionDate: string;
  weightKg: number;
  segregationStatus: string;
  wasteType: string;
  collector: string;
  remarks: string;
}

export interface ComplianceExportRow {
  householdId: string;
  householdName: string;
  purok: string;
  totalCollections: number;
  segregatedCount: number;
  complianceRate: string;
  lastCollection: string;
}

function formatExportDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function headerBlock(title: string, periodLabel: string, totalRecords: number): (string | number)[][] {
  return [
    [title],
    [`Reporting Period: ${periodLabel}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Total Records: ${totalRecords}`],
    [],
  ];
}

export function exportDetailedReport(
  kind: DetailedExportKind,
  periodLabel: string,
  collections: CollectionExportRow[],
  compliance: ComplianceExportRow[],
): void {
  const wb = XLSX.utils.book_new();
  const titles: Record<DetailedExportKind, string> = {
    weekly: 'Weekly Waste Report',
    monthly: 'Monthly Waste Report',
    yearly: 'Yearly Waste Report',
    households: 'Household Waste Records',
    collections: 'Waste Collection Records',
    segregation: 'Segregation Records',
    compliance: 'Compliance Summary',
  };
  const title = titles[kind];

  if (kind === 'compliance') {
    const sheet = XLSX.utils.aoa_to_sheet([
      ...headerBlock(title, periodLabel, compliance.length),
      ['Household ID', 'Household Name', 'Purok', 'Total Collections', 'Segregated', 'Compliance Rate', 'Last Collection'],
      ...compliance.map((row) => [
        row.householdId,
        row.householdName,
        row.purok,
        row.totalCollections,
        row.segregatedCount,
        row.complianceRate,
        row.lastCollection,
      ]),
    ]);
    setColWidths(sheet, [14, 24, 12, 18, 12, 16, 16]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Compliance');
  } else {
    const rows =
      kind === 'segregation'
        ? collections.filter((row) => row.segregationStatus.toLowerCase() !== 'segregated')
        : collections;
    const sheet = XLSX.utils.aoa_to_sheet([
      ...headerBlock(title, periodLabel, rows.length),
      ['Household ID', 'Household Name', 'Purok', 'Collection Date', 'Waste Weight (kg)', 'Segregation Status', 'Waste Type', 'Collector', 'Remarks'],
      ...rows.map((row) => [
        row.householdId,
        row.householdName,
        row.purok,
        formatExportDate(row.collectionDate),
        row.weightKg,
        row.segregationStatus,
        row.wasteType,
        row.collector,
        row.remarks,
      ]),
    ]);
    setColWidths(sheet, [14, 24, 12, 16, 18, 18, 16, 22, 24]);
    XLSX.utils.book_append_sheet(wb, sheet, 'Records');

    const totalKg = rows.reduce((sum, row) => sum + Number(row.weightKg || 0), 0);
    const segregated = rows.filter((row) => row.segregationStatus.toLowerCase() === 'segregated').length;
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ...headerBlock(`${title} — Summary`, periodLabel, rows.length),
      ['Metric', 'Value'],
      ['Total Collections', rows.length],
      ['Total Waste (kg)', Math.round(totalKg * 100) / 100],
      ['Segregated Collections', segregated],
      ['Segregation Rate (%)', rows.length ? Math.round((segregated / rows.length) * 1000) / 10 : 0],
      ['Reporting Households', new Set(rows.map((row) => row.householdId)).size],
    ]);
    setColWidths(summarySheet, [24, 18]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  }

  const filename = `ecotrack-${kind}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}