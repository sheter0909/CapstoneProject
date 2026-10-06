import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { pagination } from '../validators.js';
import { list, reportByPeriod } from './helpers.js';

export const reportRoutes = Router();

async function getDashboardStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [total, active, inactive, archived, pendingAlerts] = await Promise.all([
      prisma.household.count(),
      prisma.household.count({ where: { status: 'active' } }),
      prisma.household.count({ where: { status: 'inactive' } }),
      prisma.household.count({ where: { status: 'archived' } }),
      prisma.activityLog.count({ where: { status: 'pending' } }),
    ]);
    return ok(res, {
      totalHouseholds: total,
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

async function getRecentActivity(req: Request, res: Response, next: NextFunction) {
  try {
    return ok(res, await list(prisma.activityLog, req, {}));
  } catch (error) {
    next(error);
  }
}

async function getReportsSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const [totalHouseholds, activeCollectors, entries] = await Promise.all([
      prisma.household.count(),
      prisma.garbageCollector.count({ where: { status: 'active' } }),
      prisma.collectionEntry.findMany({ select: { wasteType: true, weightKg: true } }),
    ]);
    const wasteCollected = entries.reduce((sum, entry) => sum + Number(entry.weightKg), 0);
    const recycled = entries
      .filter((entry) => entry.wasteType === 'recyclable')
      .reduce((sum, entry) => sum + Number(entry.weightKg), 0);
    return ok(res, { totalHouseholds, activeCollectors, wasteCollected, recycledRate: wasteCollected ? (recycled / wasteCollected) * 100 : 0 });
  } catch (error) {
    next(error);
  }
}

async function getWasteTypeDistribution(_req: Request, res: Response, next: NextFunction) {
  try {
    const entries = await prisma.collectionEntry.findMany({ select: { wasteType: true, weightKg: true } });
    const totals = new Map<string, number>();
    for (const entry of entries) totals.set(entry.wasteType, (totals.get(entry.wasteType) ?? 0) + Number(entry.weightKg));
    return ok(res, [...totals].map(([_id, weightKg]) => ({ _id, weightKg })));
  } catch (error) {
    next(error);
  }
}

reportRoutes.get('/dashboard/stats', requireAuth('admin'), getDashboardStats);
reportRoutes.get('/dashboard/recent-activity', requireAuth('admin'), getRecentActivity);
reportRoutes.get('/reports/summary', requireAuth('admin'), getReportsSummary);
reportRoutes.get('/reports/weekly-collection', requireAuth('admin'), reportByPeriod('day'));
reportRoutes.get('/reports/waste-type-distribution', requireAuth('admin'), getWasteTypeDistribution);
reportRoutes.get('/reports/monthly-performance', requireAuth('admin'), reportByPeriod('month'));
