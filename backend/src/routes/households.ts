import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { encryptPasswordDisplay, hashPassword } from '../auth.js';
import { created, fail, ok } from '../response.js';
import { ROLES, requireAuth, validateRequest } from '../middleware.js';
import { accountFields, householdIdQuery, idParam, pagination, password } from '../validators.js';
import {
  HOUSEHOLD_LIST_SELECT,
  adminHousehold,
  changeStatus,
  checkPurokMatch,
  isUniqueConflict,
  list,
  logActivity,
  nextHouseholdId,
  nextWarningLevelForCount,
  normalizeDateString,
  publicAccount,
  getViolationCount,
  resolveReportReason,
  violationCounts,
  withEditable,
} from './helpers.js';
import { normalizePurokName } from './puroks.js';
import { loadSkipStreak } from './escalations.js';
import type { Prisma } from '../generated/prisma/client.js';

export const householdRoutes = Router();

// Shared household list filter: `q` (formerly `search`) matches name / ID /
// purok / address, and `status` narrows to active|inactive. Archived households
// are always excluded here (they live under /archive/households).
function householdListWhere(req: Request): Prisma.HouseholdWhereInput {
  const q = String(req.query.q ?? req.query.search ?? '').trim();
  const status = String(req.query.status ?? 'all');
  return {
    status: status === 'active' || status === 'inactive' ? status : { not: 'archived' },
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { householdId: { contains: q, mode: 'insensitive' } },
            { purok: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
}

async function getHouseholds(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await list(prisma.household, req, householdListWhere(req), HOUSEHOLD_LIST_SELECT);
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
    // Optional ?limit= lets the home screen fetch only the latest entry while
    // the full history screen keeps calling this with no limit (unchanged).
    // Default shape is collections only (backward compatible). Opt in to the
    // merged view (collections + non-dismissed collector reports) with
    // ?include=reports. ?limit= works with both.
    const rawLimit = Number(req.query.limit ?? NaN);
    const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, Math.floor(rawLimit)) : undefined;
    const include = String(req.query.include ?? '').trim().toLowerCase();
    const withReports = include === 'reports';
    if (!withReports) {
      return ok(
        res,
        (
          await prisma.collectionEntry.findMany({ where: { householdId: req.user!.id }, orderBy: { timestamp: 'desc' }, ...(take ? { take } : {}) })
        ).map((entry) => ({ kind: 'collection' as const, ...entry })),
      );
    }
    // History merges completed collections with non-dismissed collector
    // reports only (warning/admin notifications are never included here).
    // Legacy report rows (created before reportReason existed) are mapped
    // from their "Report: ..." level so old reports are not lost.
    const [entries, reports] = await Promise.all([
      prisma.collectionEntry.findMany({ where: { householdId: req.user!.id }, orderBy: { timestamp: 'desc' }, ...(take ? { take } : {}) }),
      prisma.notification.findMany({
        where: {
          householdId: req.user!.id,
          senderRole: 'collector',
          dismissedAt: null,
          OR: [{ reportReason: { not: null } }, { level: { startsWith: 'Report:' } }],
        },
        orderBy: { createdAt: 'desc' },
        ...(take ? { take } : {}),
      }),
    ]);
    const flagged = reports
      .map((note) => {
        const reason = resolveReportReason(note.level, note.reportReason);
        if (!reason) return null;
        return { kind: 'report' as const, reason, ...note };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    const merged = [
      ...entries.map((entry) => ({ kind: 'collection' as const, ...entry })),
      ...flagged,
    ].sort((a, b) => +new Date(b.kind === 'collection' ? b.timestamp : b.createdAt) - +new Date(a.kind === 'collection' ? a.timestamp : a.createdAt));
    return ok(res, take ? merged.slice(0, take) : merged);
  } catch (error) {
    next(error);
  }
}

async function getOwnNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const me = req.user!.id;
    // Fetch the household to get its purokId so we can include purok-targeted notifications.
    const household = await prisma.household.findUnique({ where: { householdId: me }, select: { purokId: true, purok: true } });
    const purokId = household?.purokId ?? null;
    const purokName = household?.purok ?? null;

    const orClauses: Prisma.NotificationWhereInput[] = [
      { householdId: me },
      { recipientType: 'all-households' },
      { senderId: me, senderRole: 'household' },
    ];
    if (purokId) {
      orClauses.push({ recipientType: 'purok-households', targetPurokId: purokId });
    } else if (purokName) {
      // Legacy fallback: match by free-text purok name
      orClauses.push({ recipientType: 'purok-households', targetPurok: { equals: purokName, mode: 'insensitive' } });
    }

    return ok(
      res,
      await prisma.notification.findMany({
        where: { OR: orClauses },
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
    // Detail endpoint only (no N+1 on the list): live skip streak plus
    // whether an open follow-up escalation exists for the badge.
    const [skip, followUp] = await Promise.all([
      loadSkipStreak(household.householdId),
      prisma.skipEscalation.findFirst({ where: { householdId: household.householdId, status: 'open', level: 'follow_up' }, select: { id: true } }),
    ]);
    return ok(res, {
      ...adminHousehold(household),
      violationCount: counts[household.householdId] ?? 0,
      skipStreak: skip.streak,
      needsFollowUp: followUp !== null,
    });
  } catch (error) {
    next(error);
  }
}

async function createHousehold(req: Request, res: Response, next: NextFunction) {
  try {
    let householdId = req.body.householdId ? String(req.body.householdId).trim() : await nextHouseholdId();
    const isAutoGenerated = !req.body.householdId;
    const existing = await prisma.household.findUnique({ where: { householdId } });
    if (existing) {
      if (isAutoGenerated) {
        householdId = await nextHouseholdId();
        const stillExists = await prisma.household.findUnique({ where: { householdId } });
        if (stillExists) {
          return fail(res, 409, 'Could not generate a unique Household ID. Please try again.', [{ field: 'householdId', message: 'Could not generate a unique Household ID.' }]);
        }
      } else {
        return fail(res, 409, 'Household ID already exists.', [{ field: 'householdId', message: 'This Household ID is already in use.' }]);
      }
    }

    // Resolve purok: prefer purokId (FK), fall back to free-text purok string.
    let purokId: string | null = null;
    let purokName: string = req.body.purok ? normalizePurokName(String(req.body.purok)) : '';
    if (req.body.purokId) {
      const purokRecord = await prisma.purok.findUnique({ where: { id: String(req.body.purokId) } });
      if (!purokRecord) return fail(res, 404, 'Purok not found.');
      purokId = purokRecord.id;
      purokName = purokRecord.name;
    }
    if (!purokName) return fail(res, 422, 'Validation failed.', [{ field: 'purok', message: 'Purok is required.' }]);

    const household = await prisma.household.create({
      data: {
        householdId,
        fullName: req.body.fullName,
        password: await hashPassword(req.body.password),
        passwordDisplay: encryptPasswordDisplay(req.body.password),
        birthdate: normalizeDateString(req.body.birthdate),
        purok: purokName,
        address: req.body.address || purokName,
        purokId,
      },
    });
    await logActivity(req.user!.name ?? 'Admin', 'Household Created', `Created household ${household.householdId}`);
    return created(res, adminHousehold(household), 'Household created.');
  } catch (error) {
    if (isUniqueConflict(error)) {
      return fail(res, 409, 'Household ID already exists.', [{ field: 'householdId', message: 'This Household ID is already in use.' }]);
    }
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

    // Resolve purok: prefer purokId (FK), fall back to free-text purok string.
    let purokId: string | null | undefined = undefined; // undefined = keep existing
    let purokName: string | undefined = undefined;
    if (req.body.purokId !== undefined) {
      if (req.body.purokId) {
        const purokRecord = await prisma.purok.findUnique({ where: { id: String(req.body.purokId) } });
        if (!purokRecord) return fail(res, 404, 'Purok not found.');
        purokId = purokRecord.id;
        purokName = purokRecord.name;
      } else {
        purokId = null;
      }
    } else if (req.body.purok !== undefined) {
      purokName = normalizePurokName(String(req.body.purok));
    }

    const data: Prisma.HouseholdUpdateInput = {
      householdId: req.body.householdId,
      fullName: req.body.fullName,
      ...(purokName !== undefined ? { purok: purokName } : {}),
      ...(purokId !== undefined ? { purokId } : {}),
    };
    // address defaults to purokName if the caller doesn't supply one
    data.address = req.body.address || purokName || existingRecord.address;
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
    const q = String(req.query.q ?? '').trim();
    const where: Prisma.HouseholdWhereInput = {
      status: 'archived',
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { householdId: { contains: q, mode: 'insensitive' } },
              { purok: { contains: q, mode: 'insensitive' } },
              { address: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const result = await list(prisma.household, req, where, HOUSEHOLD_LIST_SELECT);
    return ok(res, { ...result, items: result.items.map((item) => publicAccount(item)) });
  } catch (error) {
    next(error);
  }
}

// Shared collector-safe household lookup: used by BOTH the QR scan flow (which
// resolves the QR payload to a Household ID) and the manual ID entry flow, so
// they can never drift onto different endpoints or shapes again.
// Returns only what a collector needs — never password hashes, passwordDisplay,
// emails, or birthdates (publicAccount already strips the secrets; the explicit
// pick below additionally drops private identity fields).
async function lookupHouseholdForCollector(req: Request, res: Response, next: NextFunction) {
  try {
    // Household IDs are strings: never Number() — that would drop leading zeros.
    const householdId = String(req.query.householdId ?? req.params.id ?? '').trim();
    if (!householdId) {
      return fail(res, 422, 'Validation failed.', [{ field: 'householdId', message: 'Household ID is required.' }]);
    }
    // Independent queries run together. Authorization order is unchanged: a
    // missing household still 404s before the collector's purok is checked.
    const needsPurokCheck = req.user?.role === 'collector';
    const [account, collector] = await Promise.all([
      prisma.household.findUnique({ where: { householdId } }),
      needsPurokCheck
        ? prisma.garbageCollector.findUnique({ where: { collectorId: req.user!.id } })
        : Promise.resolve(null),
    ]);
    if (!account) return fail(res, 404, 'Household not found.');
    if (needsPurokCheck) {
      const purokError = checkPurokMatch(collector?.purokId, account.purokId);
      if (purokError) return fail(res, 403, purokError);
    }
    const [notSegregatedCount, summaryHistory, violationCount] = await Promise.all([
      prisma.collectionEntry.count({ where: { householdId, segregationStatus: 'not_segregated' } }),
      prisma.collectionEntry.findMany({ where: { householdId }, orderBy: { timestamp: 'desc' }, take: 10 }),
      getViolationCount(householdId),
    ]);
    return ok(res, {
      household: {
        householdId: account.householdId,
        fullName: account.fullName,
        purok: account.purok,
        purokId: account.purokId,
        address: account.address,
        status: account.status,
      },
      history: summaryHistory.map((entry) => withEditable(entry, req.user!.id)),
      notSegregatedCount,
      violationCount,
      nextWarningLevel: nextWarningLevelForCount(notSegregatedCount),
    });
  } catch (error) {
    next(error);
  }
}

async function getHouseholdSummary(req: Request, res: Response, next: NextFunction) {
  return lookupHouseholdForCollector(req, res, next);
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

async function getHouseholdOptions(_req: Request, res: Response, next: NextFunction) {
  try {
    const households = await prisma.household.findMany({
      where: { status: { not: 'archived' } },
      select: { householdId: true, fullName: true },
      orderBy: { householdId: 'asc' },
    });
    return ok(
      res,
      households.map((h) => ({ id: h.householdId, label: `${h.householdId} — ${h.fullName}` }))
    );
  } catch (error) {
    next(error);
  }
}

async function getNextHouseholdId(_req: Request, res: Response, next: NextFunction) {
  try {
    return ok(res, { id: await nextHouseholdId() });
  } catch (error) {
    next(error);
  }
}

householdRoutes.get('/households', requireAuth('admin'), pagination, validateRequest, getHouseholds);
householdRoutes.get('/households/options', requireAuth('admin'), getHouseholdOptions);
householdRoutes.get('/households/next-id', requireAuth('admin'), getNextHouseholdId);
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
// Manual + QR flows share this query endpoint (collectors and admins only:
// a household-role token gets 403 here, never household data).
householdRoutes.get('/collector/households/lookup', requireAuth(ROLES.collector, ROLES.admin), householdIdQuery, validateRequest, lookupHouseholdForCollector);
householdRoutes.get('/households/:id/summary', requireAuth(ROLES.collector, ROLES.admin), idParam, validateRequest, getHouseholdSummary);
householdRoutes.get('/households/:id/collections', requireAuth('admin'), getHouseholdCollections);
