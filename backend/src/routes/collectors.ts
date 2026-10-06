import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { encryptPasswordDisplay, hashPassword } from '../auth.js';
import { created, fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { collectorFields, idParam, pagination, password } from '../validators.js';
import { adminCollector, changeStatus, list, logActivity, nextCollectorId, normalizeDateString, paged, publicAccount, withEditable } from './helpers.js';
import type { Prisma } from '../generated/prisma/client.js';

export const collectorRoutes = Router();

async function getCollectors(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await list(prisma.garbageCollector, req, { status: { not: 'archived' } });
    return ok(res, { ...result, items: result.items.map(adminCollector) });
  } catch (error) {
    next(error);
  }
}

async function getCollectorById(req: Request, res: Response, next: NextFunction) {
  try {
    const collector = await prisma.garbageCollector.findUnique({ where: { id: String(req.params.id) } });
    if (!collector) return fail(res, 404, 'Collector not found.');
    return ok(res, adminCollector(collector));
  } catch (error) {
    next(error);
  }
}

async function createCollector(req: Request, res: Response, next: NextFunction) {
  try {
    const collectorId = req.body.collectorId ? String(req.body.collectorId).trim().toUpperCase() : await nextCollectorId();
    const existing = await prisma.garbageCollector.findUnique({ where: { collectorId } });
    if (existing) {
      return fail(res, 409, 'Collector ID already exists.', [{ field: 'collectorId', message: 'This Collector ID is already in use.' }]);
    }
    const collector = await prisma.garbageCollector.create({
      data: {
        collectorId,
        fullName: req.body.fullName,
        password: await hashPassword(req.body.password),
        passwordDisplay: encryptPasswordDisplay(req.body.password),
        birthdate: normalizeDateString(req.body.birthdate),
        assignedArea: req.body.assignedArea,
        contactNumber: req.body.contactNumber || null,
      },
    });
    await logActivity(req.user!.name ?? 'Admin', 'Collector Created', `Created garbage collector ${collector.collectorId}`);
    return created(res, adminCollector(collector));
  } catch (error) {
    next(error);
  }
}

async function updateCollector(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const existingRecord = await prisma.garbageCollector.findUnique({ where: { id } });
    if (!existingRecord) return fail(res, 404, 'Collector not found.');
    if (req.body.collectorId && req.body.collectorId !== existingRecord.collectorId) {
      // Normalize like create and login (auth.ts): stored IDs are uppercase.
      // Without this, saving "gc-0001" makes the next login (uppercased to "GC-0001") 404.
      const conflict = await prisma.garbageCollector.findUnique({
        where: { collectorId: String(req.body.collectorId).trim().toUpperCase() },
      });
      if (conflict) {
        return fail(res, 409, 'Collector ID already exists.', [{ field: 'collectorId', message: 'This Collector ID is already in use.' }]);
      }
    }
    const data: Prisma.GarbageCollectorUpdateInput = {
      collectorId: req.body.collectorId ? String(req.body.collectorId).trim().toUpperCase() : existingRecord.collectorId,
      fullName: req.body.fullName,
      assignedArea: req.body.assignedArea,
      contactNumber: req.body.contactNumber || null,
    };
    if (req.body.birthdate !== undefined) data.birthdate = normalizeDateString(req.body.birthdate);
    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return fail(res, 422, 'Validation failed.', [{ field: 'password', message: 'Password must be at least 8 characters.' }]);
      }
      data.password = await hashPassword(req.body.password);
      data.passwordDisplay = encryptPasswordDisplay(req.body.password);
    }
    const collector = await prisma.garbageCollector.update({ where: { id }, data });
    await logActivity(req.user!.name ?? 'Admin', 'Collector Updated', `Updated garbage collector ${collector.collectorId}`);
    return ok(res, adminCollector(collector));
  } catch (error) {
    next(error);
  }
}

async function getArchivedCollectors(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await list(prisma.garbageCollector, req, { status: 'archived' });
    return ok(res, { ...result, items: result.items.map((item) => publicAccount(item)) });
  } catch (error) {
    next(error);
  }
}

async function getCollectorCollections(req: Request, res: Response, next: NextFunction) {
  try {
    const collectorId = String(req.params.id);
    const collector = await prisma.garbageCollector.findFirst({ where: { collectorId } });
    if (!collector) return fail(res, 404, 'Collector not found.');
    const entries = await prisma.collectionEntry.findMany({ where: { collectorId }, orderBy: { timestamp: 'desc' } });
    const householdIds = [...new Set(entries.map((entry) => entry.householdId))];
    const households = householdIds.length
      ? await prisma.household.findMany({ where: { householdId: { in: householdIds } } })
      : [];
    const householdById = new Map(households.map((household) => [household.householdId, household]));
    return ok(res, {
      collector: { collectorId: collector.collectorId, fullName: collector.fullName },
      collections: entries.map((entry) => {
        const household = householdById.get(entry.householdId);
        return {
          ...entry,
          weightKg: Number(entry.weightKg),
          householdName: household?.fullName ?? entry.householdId,
          householdPurok: household?.purok ?? '',
          householdAddress: household?.address ?? '',
        };
      }),
    });
  } catch (error) {
    next(error);
  }
}

async function getOwnActivityLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paged(req);
    const where = { collectorId: req.user!.id };
    const [items, total] = await Promise.all([
      prisma.collectionEntry.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.collectionEntry.count({ where }),
    ]);
    return ok(res, { items: items.map((entry) => withEditable(entry, req.user!.id)), total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
}

async function getOwnReports(req: Request, res: Response, next: NextFunction) {
  try {
    const entries = await prisma.collectionEntry.findMany({ where: { collectorId: req.user!.id }, select: { wasteType: true, weightKg: true } });
    const totals = new Map<string, { totalKg: number; entries: number }>();
    for (const entry of entries) {
      const current = totals.get(entry.wasteType) ?? { totalKg: 0, entries: 0 };
      totals.set(entry.wasteType, { totalKg: current.totalKg + Number(entry.weightKg), entries: current.entries + 1 });
    }
    return ok(res, [...totals].map(([_id, data]) => ({ _id, ...data })));
  } catch (error) {
    next(error);
  }
}

async function getOwnNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const me = req.user!.id;
    return ok(
      res,
      await prisma.notification.findMany({
        where: { OR: [{ collectorId: me }, { recipientType: 'all-collectors' }, { senderId: me, senderRole: 'collector' }] },
        orderBy: { createdAt: 'desc' },
      }),
    );
  } catch (error) {
    next(error);
  }
}

collectorRoutes.get('/collectors', requireAuth('admin'), pagination, validateRequest, getCollectors);
collectorRoutes.get('/collectors/:id', requireAuth('admin'), idParam, validateRequest, getCollectorById);
collectorRoutes.post('/collectors', requireAuth('admin'), [...collectorFields, password, validateRequest], createCollector);
collectorRoutes.put('/collectors/:id', requireAuth('admin'), [idParam, ...collectorFields, validateRequest], updateCollector);
collectorRoutes.patch('/collectors/:id/archive', requireAuth('admin'), idParam, validateRequest, (req, res, next) =>
  changeStatus(req, res, next, prisma.garbageCollector, 'archived', 'Collector Archived'),
);
collectorRoutes.patch('/collectors/:id/unarchive', requireAuth('admin'), idParam, validateRequest, (req, res, next) =>
  changeStatus(req, res, next, prisma.garbageCollector, 'active', 'Collector Restored'),
);
collectorRoutes.get('/archive/collectors', requireAuth('admin'), pagination, validateRequest, getArchivedCollectors);
collectorRoutes.get('/collectors/:id/collections', requireAuth('admin'), getCollectorCollections);
collectorRoutes.get('/collectors/me/activity-logs', requireAuth('collector'), pagination, validateRequest, getOwnActivityLogs);
collectorRoutes.get('/collectors/me/reports', requireAuth('collector'), getOwnReports);
collectorRoutes.get('/collectors/me/notifications', requireAuth('collector'), getOwnNotifications);
