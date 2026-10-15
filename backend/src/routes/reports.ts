import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { ok } from '../response.js';
import { requireAuth } from '../middleware.js';
import { ACTIVITY_LOG_LIST_SELECT, list, reportByPeriod } from './helpers.js';
import type { Prisma } from '../generated/prisma/client.js';

export const reportRoutes = Router();

// ─── Authoritative rule ────────────────────────────────────────────────────
// A "household" in any public-facing count = status is active OR inactive
// (i.e. NOT archived). Archived accounts are fully excluded.
// This matches what GET /api/households returns (status: { not: 'archived' })
// and what the Household Management page shows in its header.
const NON_ARCHIVED_HOUSEHOLD = { status: { not: 'archived' as const } };
const ACTIVE_COLLECTOR = { status: 'active' as const };

// Current calendar month, in server-local time (UTC – acceptable since
// Render runs UTC and month boundaries rarely matter at midnight).
function currentMonthRange(): { gte: Date; lt: Date } {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth(), 1),
    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function previousMonthRange(): { gte: Date; lt: Date } {
  const now = new Date();
  return {
    gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    lt: new Date(now.getFullYear(), now.getMonth(), 1),
  };
}

function countDelta(current: number, previous: number): string {
  if (current === 0 && previous === 0) return '';
  const diff = current - previous;
  return `${diff >= 0 ? '+' : ''}${diff} this month`;
}

function percentDelta(currentVal: number, previousVal: number): string {
  if (!previousVal) return '';
  const change = ((currentVal - previousVal) / previousVal) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% this month`;
}

// Sums weight per waste type in the database (GROUP BY) instead of loading every
// row and reducing in memory. Semantics match the previous wasteStats: total is
// the sum of all weights, recycled is the sum for wasteType = 'recyclable', and
// rate is recycled/total*100 (0 when total is 0).
async function wasteAggregate(where: Prisma.CollectionEntryWhereInput): Promise<{ total: number; rate: number }> {
  const grouped = await prisma.collectionEntry.groupBy({
    by: ['wasteType'],
    where,
    _sum: { weightKg: true },
  });
  let total = 0;
  let recycled = 0;
  for (const row of grouped) {
    const sum = Number(row._sum.weightKg ?? 0);
    total += sum;
    if (row.wasteType === 'recyclable') recycled += sum;
  }
  return { total, rate: total ? (recycled / total) * 100 : 0 };
}

// ─── Dashboard stats ───────────────────────────────────────────────────────
// totalHouseholds now excludes archived to match Household Management page.
async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [nonArchived, active, inactive, archived, pendingAlerts] = await Promise.all([
      prisma.household.count({ where: NON_ARCHIVED_HOUSEHOLD }),
      prisma.household.count({ where: { status: 'active' } }),
      prisma.household.count({ where: { status: 'inactive' } }),
      prisma.household.count({ where: { status: 'archived' } }),
      prisma.activityLog.count({ where: { status: 'pending' } }),
    ]);
    return ok(res, {
      totalHouseholds: nonArchived,
      activeHouseholds: active,
      inactiveHouseholds: inactive,
      archivedHouseholds: archived,
      dailyCollectionTarget: 0,
      recyclingParticipation: 0,
      pendingAlerts,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Recent activity ───────────────────────────────────────────────────────
async function getRecentActivity(req: Request, res: Response, next: NextFunction) {
  try {
    return ok(res, await list(prisma.activityLog, req, {}, ACTIVITY_LOG_LIST_SELECT));
  } catch (error) {
    next(error);
  }
}

// ─── Reports summary (used by the Reports page chart section) ──────────────
// Was returning prisma.household.count() = 17 (all). Now uses NON_ARCHIVED = 16.
async function getReportsSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const [totalHouseholds, activeCollectors, waste] = await Promise.all([
      prisma.household.count({ where: NON_ARCHIVED_HOUSEHOLD }),
      prisma.garbageCollector.count({ where: ACTIVE_COLLECTOR }),
      wasteAggregate({}),
    ]);
    return ok(res, { totalHouseholds, activeCollectors, wasteCollected: waste.total, recycledRate: waste.rate });
  } catch (error) {
    next(error);
  }
}

// ─── Unified stats summary (GET /api/stats/summary) ───────────────────────
// Single source of truth for the four KPI cards across Dashboard, Reports,
// and Household Management. Includes real month-over-month deltas computed
// from live data so no hardcoded "+12 this month" strings exist anywhere.
async function getStatsSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const thisMonth = currentMonthRange();
    const lastMonth = previousMonthRange();

    const [
      totalHouseholds,
      thisMonthHouseholds,
      lastMonthHouseholds,
      activeCollectors,
      thisMonthCollectors,
      lastMonthCollectors,
      all,
      thisM,
      lastM,
    ] = await Promise.all([
      prisma.household.count({ where: NON_ARCHIVED_HOUSEHOLD }),
      prisma.household.count({ where: { ...NON_ARCHIVED_HOUSEHOLD, joinDate: thisMonth } }),
      prisma.household.count({ where: { ...NON_ARCHIVED_HOUSEHOLD, joinDate: lastMonth } }),
      prisma.garbageCollector.count({ where: ACTIVE_COLLECTOR }),
      prisma.garbageCollector.count({ where: { ...ACTIVE_COLLECTOR, joinDate: thisMonth } }),
      prisma.garbageCollector.count({ where: { ...ACTIVE_COLLECTOR, joinDate: lastMonth } }),
      wasteAggregate({}),
      wasteAggregate({ timestamp: thisMonth }),
      wasteAggregate({ timestamp: lastMonth }),
    ]);

    return ok(res, {
      totalHouseholds,
      householdsDelta: countDelta(thisMonthHouseholds, lastMonthHouseholds),
      activeCollectors,
      collectorsDelta: countDelta(thisMonthCollectors, lastMonthCollectors),
      wasteCollectedKg: all.total,
      wasteDelta: percentDelta(thisM.total, lastM.total),
      recycledRate: all.rate,
      recycledDelta: percentDelta(thisM.rate, lastM.rate),
    });
  } catch (error) {
    next(error);
  }
}

// ─── Waste type distribution (supports optional from/to period filter) ─────
async function getWasteTypeDistribution(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const where =
      from || to
        ? { timestamp: { ...(from && { gte: from }), ...(to && { lt: to }) } }
        : {};
    const entries = await prisma.collectionEntry.findMany({ where, select: { wasteType: true, weightKg: true } });
    const totals = new Map<string, number>();
    for (const entry of entries) {
      totals.set(entry.wasteType, (totals.get(entry.wasteType) ?? 0) + Number(entry.weightKg));
    }
    return ok(res, [...totals].map(([_id, weightKg]) => ({ _id, weightKg })));
  } catch (error) {
    next(error);
  }
}

// ─── Route registration ────────────────────────────────────────────────────
reportRoutes.get('/dashboard/stats', requireAuth('admin'), getDashboardStats);
reportRoutes.get('/dashboard/recent-activity', requireAuth('admin'), getRecentActivity);
reportRoutes.get('/reports/summary', requireAuth('admin'), getReportsSummary);
reportRoutes.get('/reports/weekly-collection', requireAuth('admin'), reportByPeriod('day'));
reportRoutes.get('/reports/waste-type-distribution', requireAuth('admin'), getWasteTypeDistribution);
reportRoutes.get('/reports/monthly-performance', requireAuth('admin'), reportByPeriod('month'));
// Single unified stats endpoint — all pages must use this for KPI counts.
reportRoutes.get('/stats/summary', requireAuth('admin'), getStatsSummary);
