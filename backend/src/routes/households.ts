import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { encryptPasswordDisplay, hashPassword } from '../auth.js';
import { created, fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { accountFields, idParam, pagination, password } from '../validators.js';
import {
  adminHousehold,
  changeStatus,
  list,
  logActivity,
  nextWarningLevelForCount,
  normalizeDateString,
  publicAccount,
  violationCounts,
  withEditable,
} from './helpers.js';
import type { Prisma } from '../generated/prisma/client.js';

export const householdRoutes = Router();

async function getHouseholds(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search ?? '');
    const where: Prisma.HouseholdWhereInput = {
      status: { not: 'archived' },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { householdId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const result = await list(prisma.household, req, where);
    const counts = await violationCounts(result.items.map((item) => item.householdId));
    return ok(res, {
      ...result,
      items: result.items.map((item) => ({ ...adminHousehold(item), violationCount: counts[item.householdId] ?? 0 })),
    });
  } catch (error) {
    next(error);
  }
}

// NOTE: /households/me* must stay above /households/:id — Express matches in order.
async function getOwnHousehold(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await prisma.household.findUnique({ where: { householdId: req.user!.id } });
    return ok(res, account ? publicAccount(account) : null);
  } catch (error) {
    next(error);
  }
}

async function getOwnHistory(req: Request, res: Response, next: NextFunction) {
  try {
    return ok(
      res,
      await prisma.collectionEntry.findMany({ where: { householdId: req.user!.id }, orderBy: { timestamp: 'desc' } }),
    );
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
        where: { OR: [{ householdId: me }, { recipientType: 'all-households' }, { senderId: me, senderRole: 'household' }] },
        orderBy: { createdAt: 'desc' },
      }),
    );
  } catch (error) {
    next(error);
  }
}

async function getHouseholdById(req: Request, res: Response, next: NextFunction) {
  try {
    const key = String(req.params.id);
    const household = await prisma.household.findFirst({ where: { OR: [{ id: key }, { householdId: key }] } });
    if (!household) return fail(res, 404, 'Household not found.');
    const counts = await violationCounts([household.householdId]);
    return ok(res, { ...adminHousehold(household), violationCount: counts[household.householdId] ?? 0 });
  } catch (error) {
    next(error);
  }
}

async function createHousehold(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.household.findUnique({ where: { householdId: req.body.householdId } });
    if (existing) {
      return fail(res, 409, 'Household ID already exists.', [{ field: 'householdId', message: 'This Household ID is already in use.' }]);
    }
    const household = await prisma.household.create({
      data: {
        householdId: req.body.householdId,
        fullName: req.body.fullName,
        password: await hashPassword(req.body.password),
        passwordDisplay: encryptPasswordDisplay(req.body.password),
        birthdate: normalizeDateString(req.body.birthdate),
        purok: req.body.purok,
        address: req.body.address || req.body.purok,
      },
    });
    await logActivity(req.user!.name ?? 'Admin', 'Household Created', `Created household ${household.householdId}`);
    return created(res, adminHousehold(household), 'Household created.');
  } catch (error) {
    next(error);
  }
}

async function updateHousehold(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const existingRecord = await prisma.household.findUnique({ where: { id } });
    if (!existingRecord) return fail(res, 404, 'Household not found.');
    if (req.body.householdId && req.body.householdId !== existingRecord.householdId) {
      const conflict = await prisma.household.findUnique({ where: { householdId: req.body.householdId } });
      if (conflict) {
        return fail(res, 409, 'Household ID already exists.', [{ field: 'householdId', message: 'This Household ID is already in use.' }]);
      }
    }
    const data: Prisma.HouseholdUpdateInput = {
      householdId: req.body.householdId,
      fullName: req.body.fullName,
      purok: req.body.purok,
      address: req.body.address || req.body.purok,
    };
    if (req.body.birthdate !== undefined) data.birthdate = normalizeDateString(req.body.birthdate);
    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return fail(res, 422, 'Validation failed.', [{ field: 'password', message: 'Password must be at least 8 characters.' }]);
      }
      data.password = await hashPassword(req.body.password);
      data.passwordDisplay = encryptPasswordDisplay(req.body.password);
    }
    const household = await prisma.household.update({ where: { id }, data });
    await logActivity(req.user!.name ?? 'Admin', 'Household Updated', `Updated household ${household.householdId}`);
    return ok(res, adminHousehold(household));
  } catch (error) {
    next(error);
  }
}

async function getArchivedHouseholds(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await list(prisma.household, req, { status: 'archived' });
    return ok(res, { ...result, items: result.items.map((item) => publicAccount(item)) });
  } catch (error) {
    next(error);
  }
}

async function getHouseholdSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const householdId = String(req.params.id);
    const account = await prisma.household.findUnique({ where: { householdId } });
    const notSegregatedCount = await prisma.collectionEntry.count({ where: { householdId, segregationStatus: 'not_segregated' } });
    const summaryHistory = await prisma.collectionEntry.findMany({ where: { householdId }, orderBy: { timestamp: 'desc' }, take: 10 });
    return ok(res, {
      household: account ? publicAccount(account) : null,
      history: summaryHistory.map((entry) => withEditable(entry, req.user!.id)),
      notSegregatedCount,
      nextWarningLevel: nextWarningLevelForCount(notSegregatedCount),
    });
  } catch (error) {
    next(error);
  }
}

async function getHouseholdCollections(req: Request, res: Response, next: NextFunction) {
  try {
    const key = String(req.params.id);
    const household = await prisma.household.findFirst({ where: { OR: [{ id: key }, { householdId: key }] } });
    if (!household) return fail(res, 404, 'Household not found.');
    return ok(
      res,
      await prisma.collectionEntry.findMany({ where: { householdId: household.householdId }, orderBy: { timestamp: 'desc' } }),
    );
  } catch (error) {
    next(error);
  }
}

householdRoutes.get('/households', requireAuth('admin'), pagination, validateRequest, getHouseholds);
householdRoutes.get('/households/me', requireAuth('household'), getOwnHousehold);
householdRoutes.get('/households/me/history', requireAuth('household'), getOwnHistory);
householdRoutes.get('/households/me/notifications', requireAuth('household'), getOwnNotifications);
householdRoutes.get('/households/:id', requireAuth('admin'), idParam, validateRequest, getHouseholdById);
householdRoutes.post('/households', requireAuth('admin'), [...accountFields, password, validateRequest], createHousehold);
householdRoutes.put('/households/:id', requireAuth('admin'), [idParam, ...accountFields, validateRequest], updateHousehold);
householdRoutes.patch('/households/:id/archive', requireAuth('admin'), idParam, validateRequest, (req, res, next) =>
  changeStatus(req, res, next, prisma.household, 'archived', 'Household Archived'),
);
householdRoutes.patch('/households/:id/unarchive', requireAuth('admin'), idParam, validateRequest, (req, res, next) =>
  changeStatus(req, res, next, prisma.household, 'active', 'Household Restored'),
);
householdRoutes.get('/archive/households', requireAuth('admin'), pagination, validateRequest, getArchivedHouseholds);
householdRoutes.get('/households/:id/summary', requireAuth('collector'), getHouseholdSummary);
householdRoutes.get('/households/:id/collections', requireAuth('admin'), getHouseholdCollections);
