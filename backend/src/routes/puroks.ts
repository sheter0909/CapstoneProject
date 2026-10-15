import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { created, fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { idParam } from '../validators.js';
import { logActivity } from './helpers.js';
import { body, param } from 'express-validator';

export const purokRoutes = Router();

// ─── Normalise ────────────────────────────────────────────────────────────────

/**
 * Normalise a purok name: trim whitespace, collapse internal runs of spaces,
 * then title-case every word.
 *   "  purok calan 1 " → "Purok Calan 1"
 */
export function normalizePurokName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Validators ───────────────────────────────────────────────────────────────

const purokNameBody = body('name')
  .trim()
  .notEmpty()
  .withMessage('Purok name is required.')
  .isLength({ max: 100 })
  .withMessage('Purok name must be at most 100 characters.');

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** GET /puroks  — list all puroks (active first, then alphabetically). */
async function listPuroks(req: Request, res: Response, next: NextFunction) {
  try {
    const puroks = await prisma.purok.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return ok(res, puroks);
  } catch (error) {
    next(error);
  }
}

/** GET /puroks/:id/household-count  — active household count for a purok. */
async function purokHouseholdCount(req: Request, res: Response, next: NextFunction) {
  try {
    const purokId = String(req.params.id);
    const purok = await prisma.purok.findUnique({ where: { id: purokId } });
    if (!purok) return fail(res, 404, 'Purok not found.');

    const count = await prisma.household.count({
      where: { purokId, status: { not: 'archived' } },
    });
    return ok(res, { purokId, purokName: purok.name, activeHouseholds: count });
  } catch (error) {
    next(error);
  }
}

/** POST /puroks  — create a new purok. */
async function createPurok(req: Request, res: Response, next: NextFunction) {
  try {
    const name = normalizePurokName(String(req.body.name));
    const existing = await prisma.purok.findUnique({ where: { name } });
    if (existing) {
      return fail(res, 409, `A purok named "${name}" already exists.`);
    }
    const collectionDay = req.body.collectionDay ? String(req.body.collectionDay).trim() : null;
    const purok = await prisma.purok.create({ data: { name, collectionDay } });
    await logActivity(req.user!.name ?? 'Admin', 'Purok Created', `Created purok "${name}"`);
    return created(res, purok, 'Purok created.');
  } catch (error) {
    next(error);
  }
}

/** PUT /puroks/:id  — rename or update a purok. */
async function updatePurok(req: Request, res: Response, next: NextFunction) {
  try {
    const purokId = String(req.params.id);
    const existing = await prisma.purok.findUnique({ where: { id: purokId } });
    if (!existing) return fail(res, 404, 'Purok not found.');

    const name = req.body.name !== undefined ? normalizePurokName(String(req.body.name)) : existing.name;
    if (name !== existing.name) {
      const conflict = await prisma.purok.findUnique({ where: { name } });
      if (conflict) return fail(res, 409, `A purok named "${name}" already exists.`);
    }

    const collectionDay =
      req.body.collectionDay !== undefined
        ? req.body.collectionDay
          ? String(req.body.collectionDay).trim()
          : null
        : existing.collectionDay;

    const isActive =
      req.body.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive;

    const purok = await prisma.purok.update({
      where: { id: purokId },
      data: { name, collectionDay, isActive },
    });

    // Also sync the free-text legacy fields so lookups still work
    if (name !== existing.name) {
      await Promise.all([
        prisma.household.updateMany({
          where: { purokId },
          data: { purok: name },
        }),
        prisma.garbageCollector.updateMany({
          where: { purokId },
          data: { assignedArea: name },
        }),
      ]);
    }

    await logActivity(req.user!.name ?? 'Admin', 'Purok Updated', `Updated purok "${name}"`);
    return ok(res, purok, 'Purok updated.');
  } catch (error) {
    next(error);
  }
}

/** PATCH /puroks/:id/deactivate  — soft-deactivate (isActive = false). */
async function deactivatePurok(req: Request, res: Response, next: NextFunction) {
  try {
    const purokId = String(req.params.id);
    const existing = await prisma.purok.findUnique({ where: { id: purokId } });
    if (!existing) return fail(res, 404, 'Purok not found.');
    const purok = await prisma.purok.update({ where: { id: purokId }, data: { isActive: false } });
    await logActivity(req.user!.name ?? 'Admin', 'Purok Deactivated', `Deactivated purok "${existing.name}"`);
    return ok(res, purok, 'Purok deactivated.');
  } catch (error) {
    next(error);
  }
}

/** PATCH /puroks/:id/activate  — re-activate a deactivated purok. */
async function activatePurok(req: Request, res: Response, next: NextFunction) {
  try {
    const purokId = String(req.params.id);
    const existing = await prisma.purok.findUnique({ where: { id: purokId } });
    if (!existing) return fail(res, 404, 'Purok not found.');
    const purok = await prisma.purok.update({ where: { id: purokId }, data: { isActive: true } });
    await logActivity(req.user!.name ?? 'Admin', 'Purok Activated', `Activated purok "${existing.name}"`);
    return ok(res, purok, 'Purok activated.');
  } catch (error) {
    next(error);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

purokRoutes.get('/puroks', requireAuth('admin'), listPuroks);
purokRoutes.get('/puroks/:id/household-count', requireAuth('admin'), idParam, validateRequest, purokHouseholdCount);
purokRoutes.post('/puroks', requireAuth('admin'), [purokNameBody, validateRequest], createPurok);
purokRoutes.put('/puroks/:id', requireAuth('admin'), [idParam, purokNameBody, validateRequest], updatePurok);
purokRoutes.patch('/puroks/:id/deactivate', requireAuth('admin'), idParam, validateRequest, deactivatePurok);
purokRoutes.patch('/puroks/:id/activate', requireAuth('admin'), idParam, validateRequest, activatePurok);
