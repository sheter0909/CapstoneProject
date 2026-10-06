import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { fail, ok, created } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { collectionFields, idParam, pagination } from '../validators.js';
import {
  buildWarningText,
  EDIT_WINDOW_HOURS,
  editableUntilFor,
  paged,
  warningLevelForCount,
  withEditable,
} from './helpers.js';

export const collectionRoutes = Router();

async function getCollections(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = paged(req);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    const where: Record<string, unknown> = {};
    if (from && !isNaN(from.getTime())) (where as Record<string, { gte: Date }>).timestamp = { gte: from };
    if (to && !isNaN(to.getTime())) where.timestamp = { ...(typeof where.timestamp === 'object' ? (where.timestamp as object) : {}), lte: to };
    const [entries, total] = await Promise.all([
      prisma.collectionEntry.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.collectionEntry.count({ where }),
    ]);
    const householdIds = [...new Set(entries.map((entry) => entry.householdId))];
    const collectorIds = [...new Set(entries.map((entry) => entry.collectorId))];
    const [households, collectors] = await Promise.all([
      householdIds.length ? prisma.household.findMany({ where: { householdId: { in: householdIds } } }) : [],
      collectorIds.length ? prisma.garbageCollector.findMany({ where: { collectorId: { in: collectorIds } } }) : [],
    ]);
    const householdById = new Map(households.map((household) => [household.householdId, household] as const));
    const collectorById = new Map(collectors.map((collector) => [collector.collectorId, collector] as const));
    return ok(res, {
      items: entries.map((entry) => {
        const household = householdById.get(entry.householdId);
        const collector = collectorById.get(entry.collectorId);
        return {
          ...entry,
          weightKg: Number(entry.weightKg),
          householdName: household?.fullName ?? entry.householdId,
          householdPurok: household?.purok ?? '',
          householdAddress: household?.address ?? '',
          collectorName: collector?.fullName ?? entry.collectorId,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

async function submitCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const householdId = String(req.body.householdId ?? '').trim();
    if (!householdId) return fail(res, 400, 'Household ID is required.');
    const household = await prisma.household.findUnique({ where: { householdId } });
    if (!household) return fail(res, 404, 'Household not found. Check the Household ID or QR code and try again.');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const existing = await prisma.collectionEntry.findFirst({ where: { householdId, timestamp: { gte: sevenDaysAgo } } });
    if (existing) return fail(res, 409, 'This household was already collected this week.');
    const isNotSegregatedPost = req.body.segregationStatus === 'not_segregated';
    const wasteTypePost = isNotSegregatedPost ? 'mixed' : req.body.wasteType;
    if (!isNotSegregatedPost && (!wasteTypePost || wasteTypePost === 'mixed')) {
      return fail(res, 422, 'Choose a waste type.', [{ field: 'wasteType', message: 'Choose a waste type.' }]);
    }
    const collector = await prisma.garbageCollector.findUnique({ where: { collectorId: req.user!.id } });
    const collectorName = collector?.fullName ?? req.user!.name ?? req.user!.id;
    const result = await prisma.$transaction(async (tx) => {
      const createdEntry = await tx.collectionEntry.create({
        data: {
          householdId,
          collectorId: req.user!.id,
          segregationStatus: req.body.segregationStatus,
          wasteType: wasteTypePost,
          weightKg: req.body.weightKg,
        },
      });
      await tx.household.update({ where: { householdId }, data: { lastCollection: createdEntry.timestamp } });
      let warning: { level: string; count: number } | null = null;
      if (createdEntry.segregationStatus === 'not_segregated') {
        const count = await tx.collectionEntry.count({ where: { householdId, segregationStatus: 'not_segregated' } });
        const level = warningLevelForCount(count);
        const { title, message } = buildWarningText(level, count, createdEntry.timestamp, createdEntry.weightKg);
        await tx.notification.create({
          data: {
            householdId,
            senderId: req.user!.id,
            senderRole: 'collector',
            senderName: collectorName,
            recipientType: 'household',
            title,
            message,
            level,
            collectionEntryId: createdEntry.id,
          },
        });
        await tx.activityLog.create({
          data: { user: collectorName, activityType: 'Household Warned', description: `Issued ${level} to household ${householdId}` },
        });
        warning = { level, count };
      }
      return { entry: createdEntry, warning };
    });
    return created(res, {
      ...result.entry,
      weightKg: Number((result.entry as unknown as { weightKg: unknown }).weightKg),
      warning: result.warning,
    });
  } catch (error) {
    next(error);
  }
}

async function updateCollection(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await prisma.collectionEntry.findUnique({ where: { id: String(req.params.id) } });
    if (!entry) return fail(res, 404, 'Entry not found.');
    if (entry.collectorId !== req.user!.id) return fail(res, 403, 'You can only edit your own entries.');
    if (Date.now() > editableUntilFor(entry.timestamp).getTime()) {
      return fail(res, 403, `Edit window has expired (limit: ${EDIT_WINDOW_HOURS} hours).`);
    }
    const wasNotSegregated = entry.segregationStatus === 'not_segregated';
    const willBeNotSegregated = req.body.segregationStatus === 'not_segregated';
    const collector = await prisma.garbageCollector.findUnique({ where: { collectorId: req.user!.id } });
    const collectorName = collector?.fullName ?? req.user!.name ?? req.user!.id;
    const wasteTypePut = willBeNotSegregated ? 'mixed' : req.body.wasteType;
    if (!willBeNotSegregated && (!wasteTypePut || wasteTypePut === 'mixed')) {
      return fail(res, 422, 'Choose a waste type.', [{ field: 'wasteType', message: 'Choose a waste type.' }]);
    }
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.collectionEntry.update({
        where: { id: entry.id },
        data: {
          segregationStatus: req.body.segregationStatus,
          wasteType: wasteTypePut,
          weightKg: req.body.weightKg,
          editedAt: new Date(),
        },
      });
      let warning: { level: string; count: number } | null = null;
      let warningRemoved = false;
      if (!wasNotSegregated && willBeNotSegregated) {
        const count = await tx.collectionEntry.count({ where: { householdId: entry.householdId, segregationStatus: 'not_segregated' } });
        const level = warningLevelForCount(count);
        const { title, message } = buildWarningText(level, count, updated.timestamp, updated.weightKg);
        await tx.notification.create({
          data: {
            householdId: entry.householdId,
            senderId: req.user!.id,
            senderRole: 'collector',
            senderName: collectorName,
            recipientType: 'household',
            title,
            message,
            level,
            collectionEntryId: entry.id,
          },
        });
        await tx.activityLog.create({
          data: { user: collectorName, activityType: 'Household Warned', description: `Issued ${level} to household ${entry.householdId}` },
        });
        warning = { level, count };
      } else if (wasNotSegregated && !willBeNotSegregated) {
        await tx.notification.deleteMany({ where: { collectionEntryId: entry.id } });
        warningRemoved = true;
      } else if (wasNotSegregated && willBeNotSegregated) {
        const count = await tx.collectionEntry.count({
          where: { householdId: entry.householdId, segregationStatus: 'not_segregated', timestamp: { lte: entry.timestamp } },
        });
        const level = warningLevelForCount(Math.max(count, 1));
        const { title, message } = buildWarningText(level, count, updated.timestamp, updated.weightKg);
        await tx.notification.updateMany({ where: { collectionEntryId: entry.id }, data: { message, title, level } });
        warning = { level, count };
      }
      return { updated, warning, warningRemoved };
    });
    return ok(
      res,
      {
        ...(result.updated as unknown as Record<string, unknown>),
        ...withEditable(result.updated, req.user!.id),
        weightKg: Number((result.updated as unknown as { weightKg: unknown }).weightKg),
        warning: result.warning,
        warningRemoved: result.warningRemoved,
      },
      result.warningRemoved ? 'Warning removed.' : 'Collection entry updated.',
    );
  } catch (error) {
    next(error);
  }
}

collectionRoutes.get('/collections', requireAuth('admin'), pagination, validateRequest, getCollections);
collectionRoutes.post('/collections', requireAuth('collector'), collectionFields, validateRequest, submitCollection);
collectionRoutes.put('/collections/:id', requireAuth('collector'), [idParam, ...collectionFields], validateRequest, updateCollection);
