import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { prisma } from './db.js';
import { hashPassword, login, encryptPasswordDisplay, decryptPasswordDisplay } from './auth.js';
import { created, fail, ok } from './response.js';
import { requireAuth, validateRequest } from './middleware.js';
import { accountFields, birthdate, collectionFields, collectorFields, idParam, login as loginFields, pagination, password } from './validators.js';

export const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', message: { success: false, message: 'Too many attempts. Try again later.' } });
const resetTokens = new Map<string, { role: 'household' | 'collector'; accountId: string; expires: number }>();
type ActivityStatusValue = 'success' | 'pending' | 'failed';

function paged(req: Request) { return { page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 20) }; }
async function list(delegate: any, req: Request, where: Record<string, unknown> = {}) { const { page, limit } = paged(req); const [items, total] = await Promise.all([delegate.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }), delegate.count({ where })]); return { items, total, page, totalPages: Math.ceil(total / limit) }; }
async function logActivity(user: string, activityType: string, description: string, status: ActivityStatusValue = 'success') { await prisma.activityLog.create({ data: { user, activityType, description, status } }); }
function publicAccount(account: any) { const { password: _password, passwordDisplay: _pd, ...safeAccount } = account; return safeAccount; }
function adminHousehold(account: any) { if (!account) return null; const { password: _password, passwordDisplay, ...rest } = account; return { ...rest, password: decryptPasswordDisplay(passwordDisplay) }; }
function adminCollector(account: any) { if (!account) return null; const { password: _password, passwordDisplay, ...rest } = account; return { ...rest, password: decryptPasswordDisplay(passwordDisplay) }; }
function cryptoToken() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function normalizeDateString(d: string | null | undefined): string | null {
  if (!d) return null;
  const trimmed = String(d).trim();
  if (!trimmed) return null;

  // 1. If format is YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, day] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 2. If format is MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (mdyMatch) {
    const [, m, day, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 3. If timestamp or parseable Date object
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return trimmed;
}

router.get('/health', (_req, res) => ok(res, { status: 'ok' }));
for (const role of ['admin', 'household', 'collector'] as const) router.post(`/auth/${role}/login`, authLimiter, loginFields, validateRequest, async (req, res, next) => { try { const result = await login(role, String(req.body.identifier), String(req.body.password)); if ('error' in result) return fail(res, 401, result.error ?? 'Invalid credentials.'); return ok(res, result, 'Login successful.'); } catch (error) { next(error); } });

for (const role of ['household', 'collector'] as const) {
  router.post(`/auth/${role}/forgot-password`, authLimiter, [body('identifier').trim().notEmpty().withMessage('Account ID is required.'), body('birthdate').trim().notEmpty().withMessage('Birthdate is required.'), validateRequest], async (req, res, next) => {
    try {
      const submittedBirthdate = normalizeDateString(req.body.birthdate);
      const identifier = String(req.body.identifier).trim();

      const account: any = role === 'household'
        ? await prisma.household.findFirst({ where: { householdId: identifier } })
        : await prisma.garbageCollector.findFirst({ where: { collectorId: identifier.toUpperCase() } });

      if (!account) {
        return fail(res, 404, 'Account ID and birthdate do not match.');
      }

      const storedBirthdate = normalizeDateString(account.birthdate);
      if (!storedBirthdate || storedBirthdate !== submittedBirthdate) {
        return fail(res, 404, 'Account ID and birthdate do not match.');
      }

      const accountId = role === 'household' ? account.householdId : account.collectorId;
      const token = cryptoToken();
      resetTokens.set(token, { role, accountId, expires: Date.now() + 15 * 60 * 1000 });
      return ok(res, { resetToken: token, accountId }, 'Identity verified.');
    } catch (error) {
      next(error);
    }
  });

  router.post(`/auth/${role}/reset-password`, [body('resetToken').notEmpty().withMessage('Reset token is required.'), password, validateRequest], async (req, res, next) => {
    try {
      const reset = resetTokens.get(req.body.resetToken);
      if (!reset || reset.role !== role || reset.expires < Date.now()) return fail(res, 401, 'Reset token is invalid or expired.');
      const delegate: any = role === 'household' ? prisma.household : prisma.garbageCollector;
      const account = await delegate.findFirst({ where: role === 'household' ? { householdId: reset.accountId } : { collectorId: reset.accountId } });
      if (!account) return fail(res, 404, 'Account not found.');
      await delegate.update({ where: { id: account.id }, data: { password: await hashPassword(req.body.password) } });
      resetTokens.delete(req.body.resetToken);
      return ok(res, null, 'Password reset successfully.');
    } catch (error) {
      next(error);
    }
  });
}

router.post('/auth/collector/change-password', requireAuth('collector'), [body('currentPassword').notEmpty().withMessage('Current password is required.'), body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')], validateRequest, async (req, res, next) => {
  try {
    const account = await prisma.garbageCollector.findUnique({ where: { collectorId: req.user!.id } });
    if (!account || !(await bcrypt.compare(req.body.currentPassword, account.password))) return fail(res, 401, 'Current password is incorrect.');
    await prisma.garbageCollector.update({ where: { id: account.id }, data: { password: await hashPassword(req.body.newPassword) } });
    return ok(res, null, 'Password changed successfully.');
  } catch (error) {
    next(error);
  }
});

router.get('/households', requireAuth('admin'), pagination, validateRequest, async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '');
    const result = await list(prisma.household, req, {
      status: { not: 'archived' },
      ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { householdId: { contains: search, mode: 'insensitive' } }] } : {}),
    });
    return ok(res, { ...result, items: result.items.map(adminHousehold) });
  } catch (error) {
    next(error);
  }
});
router.get('/households/:id', requireAuth('admin'), idParam, validateRequest, async (req, res, next) => {
  try {
    const household = await prisma.household.findUnique({ where: { id: String(req.params.id) } });
    if (!household) return fail(res, 404, 'Household not found.');
    return ok(res, adminHousehold(household));
  } catch (error) {
    next(error);
  }
});
router.post('/households', requireAuth('admin'), [...accountFields, password, validateRequest], async (req, res, next) => {
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
});
router.put('/households/:id', requireAuth('admin'), [idParam, ...accountFields, validateRequest], async (req, res, next) => {
  try {
    const data: any = {
      householdId: req.body.householdId,
      fullName: req.body.fullName,
      birthdate: normalizeDateString(req.body.birthdate),
      purok: req.body.purok,
      address: req.body.address || req.body.purok,
    };
    if (req.body.password) {
      data.password = await hashPassword(req.body.password);
      data.passwordDisplay = encryptPasswordDisplay(req.body.password);
    }
    const household = await prisma.household.update({ where: { id: String(req.params.id) }, data });
    await logActivity(req.user!.name ?? 'Admin', 'Household Updated', `Updated household ${household.householdId}`);
    return ok(res, adminHousehold(household));
  } catch (error) {
    next(error);
  }
});
router.patch('/households/:id/archive', requireAuth('admin'), idParam, validateRequest, async (req, res, next) => changeStatus(req, res, next, prisma.household, 'archived', 'Household Archived'));
router.patch('/households/:id/unarchive', requireAuth('admin'), idParam, validateRequest, async (req, res, next) => changeStatus(req, res, next, prisma.household, 'active', 'Household Restored'));

router.get('/collectors', requireAuth('admin'), pagination, validateRequest, async (req, res, next) => {
  try {
    const result = await list(prisma.garbageCollector, req, { status: { not: 'archived' } });
    return ok(res, { ...result, items: result.items.map(adminCollector) });
  } catch (error) {
    next(error);
  }
});
router.get('/collectors/:id', requireAuth('admin'), idParam, validateRequest, async (req, res, next) => {
  try {
    const collector = await prisma.garbageCollector.findUnique({ where: { id: String(req.params.id) } });
    if (!collector) return fail(res, 404, 'Collector not found.');
    return ok(res, adminCollector(collector));
  } catch (error) {
    next(error);
  }
});
router.post('/collectors', requireAuth('admin'), [...collectorFields, password, validateRequest], async (req, res, next) => {
  try {
    const collectorId = req.body.collectorId ?? await nextCollectorId();
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
});
router.put('/collectors/:id', requireAuth('admin'), [idParam, ...collectorFields, validateRequest], async (req, res, next) => {
  try {
    const data: any = {
      collectorId: req.body.collectorId,
      fullName: req.body.fullName,
      birthdate: normalizeDateString(req.body.birthdate),
      assignedArea: req.body.assignedArea,
      contactNumber: req.body.contactNumber || null,
    };
    if (req.body.password) {
      data.password = await hashPassword(req.body.password);
      data.passwordDisplay = encryptPasswordDisplay(req.body.password);
    }
    const collector = await prisma.garbageCollector.update({ where: { id: String(req.params.id) }, data });
    await logActivity(req.user!.name ?? 'Admin', 'Collector Updated', `Updated garbage collector ${collector.collectorId}`);
    return ok(res, adminCollector(collector));
  } catch (error) {
    next(error);
  }
});
router.patch('/collectors/:id/archive', requireAuth('admin'), idParam, validateRequest, async (req, res, next) => changeStatus(req, res, next, prisma.garbageCollector, 'archived', 'Collector Archived'));
router.patch('/collectors/:id/unarchive', requireAuth('admin'), idParam, validateRequest, async (req, res, next) => changeStatus(req, res, next, prisma.garbageCollector, 'active', 'Collector Restored'));

router.get('/archive/households', requireAuth('admin'), pagination, validateRequest, async (req, res, next) => { try { return ok(res, await list(prisma.household, req, { status: 'archived' })); } catch (error) { next(error); } });
router.get('/archive/collectors', requireAuth('admin'), pagination, validateRequest, async (req, res, next) => { try { return ok(res, await list(prisma.garbageCollector, req, { status: 'archived' })); } catch (error) { next(error); } });
router.get('/activity-logs', requireAuth('admin'), pagination, validateRequest, async (req, res, next) => { try { return ok(res, await list(prisma.activityLog, req, req.query.status && req.query.status !== 'all' ? { status: req.query.status } : {})); } catch (error) { next(error); } });

router.get('/dashboard/stats', requireAuth('admin'), async (_req, res, next) => { try { const [total, active, inactive, archived, pendingAlerts] = await Promise.all([prisma.household.count(), prisma.household.count({ where: { status: 'active' } }), prisma.household.count({ where: { status: 'inactive' } }), prisma.household.count({ where: { status: 'archived' } }), prisma.activityLog.count({ where: { status: 'pending' } })]); return ok(res, { totalHouseholds: total, activeHouseholds: active, inactiveHouseholds: inactive, archivedHouseholds: archived, dailyCollectionTarget: 0, recyclingParticipation: 0, pendingAlerts }); } catch (error) { next(error); } });
router.get('/dashboard/recent-activity', requireAuth('admin'), async (req, res, next) => { try { return ok(res, await list(prisma.activityLog, req)); } catch (error) { next(error); } });
router.get('/reports/summary', requireAuth('admin'), async (_req, res, next) => { try { const [totalHouseholds, activeCollectors, entries] = await Promise.all([prisma.household.count(), prisma.garbageCollector.count({ where: { status: 'active' } }), prisma.collectionEntry.findMany({ select: { wasteType: true, weightKg: true } })]); const wasteCollected = entries.reduce((sum, entry) => sum + Number(entry.weightKg), 0); const recycled = entries.filter((entry) => entry.wasteType === 'recyclable').reduce((sum, entry) => sum + Number(entry.weightKg), 0); return ok(res, { totalHouseholds, activeCollectors, wasteCollected, recycledRate: wasteCollected ? recycled / wasteCollected * 100 : 0 }); } catch (error) { next(error); } });
router.get('/reports/weekly-collection', requireAuth('admin'), reportByPeriod('day'));
router.get('/reports/waste-type-distribution', requireAuth('admin'), async (_req, res, next) => { try { const entries = await prisma.collectionEntry.findMany({ select: { wasteType: true, weightKg: true } }); const totals = new Map<string, number>(); for (const entry of entries) totals.set(entry.wasteType, (totals.get(entry.wasteType) ?? 0) + Number(entry.weightKg)); return ok(res, [...totals].map(([_id, weightKg]) => ({ _id, weightKg }))); } catch (error) { next(error); } });
router.get('/reports/monthly-performance', requireAuth('admin'), reportByPeriod('month'));

router.get('/households/me', requireAuth('household'), async (req, res, next) => { try { const account = await prisma.household.findUnique({ where: { householdId: req.user!.id } }); return ok(res, account ? publicAccount(account) : null); } catch (error) { next(error); } });
router.get('/households/me/history', requireAuth('household'), async (req, res, next) => { try { return ok(res, await prisma.collectionEntry.findMany({ where: { householdId: req.user!.id }, orderBy: { timestamp: 'desc' } })); } catch (error) { next(error); } });
router.get('/households/me/notifications', requireAuth('household'), async (req, res, next) => { try { return ok(res, await prisma.notification.findMany({ where: { householdId: req.user!.id }, orderBy: { createdAt: 'desc' } })); } catch (error) { next(error); } });
router.get('/households/:id/summary', requireAuth('collector'), async (req, res, next) => { try { const householdId = String(req.params.id); const account = await prisma.household.findUnique({ where: { householdId } }); return ok(res, { household: account ? publicAccount(account) : null, history: await prisma.collectionEntry.findMany({ where: { householdId }, orderBy: { timestamp: 'desc' }, take: 10 }) }); } catch (error) { next(error); } });
router.get('/households/:id/collections', requireAuth('admin'), async (req, res, next) => { try { return ok(res, await prisma.collectionEntry.findMany({ where: { householdId: String(req.params.id) }, orderBy: { timestamp: 'desc' } })); } catch (error) { next(error); } });
router.post('/collections', requireAuth('collector'), collectionFields, validateRequest, async (req, res, next) => { try { const entry = await prisma.collectionEntry.create({ data: { householdId: req.body.householdId, collectorId: req.user!.id, segregationStatus: req.body.segregationStatus, wasteType: req.body.wasteType, weightKg: req.body.weightKg } }); await prisma.household.update({ where: { householdId: req.body.householdId }, data: { lastCollection: entry.timestamp } }); return created(res, entry); } catch (error) { next(error); } });
router.put('/collections/:id', requireAuth('collector'), [idParam, ...collectionFields], validateRequest, async (req, res, next) => { try { const entry = await prisma.collectionEntry.findUnique({ where: { id: String(req.params.id) } }); if (!entry || entry.collectorId !== req.user!.id) return fail(res, 404, 'Collection entry not found.'); if (Date.now() - entry.timestamp.getTime() > 2 * 60 * 60 * 1000) return fail(res, 403, 'Edit window has expired for this entry.'); const updated = await prisma.collectionEntry.update({ where: { id: entry.id }, data: { segregationStatus: req.body.segregationStatus, wasteType: req.body.wasteType, weightKg: req.body.weightKg, editedAt: new Date() } }); return ok(res, updated, 'Collection entry updated.'); } catch (error) { next(error); } });
router.get('/collectors/me/activity-logs', requireAuth('collector'), pagination, validateRequest, async (req, res, next) => { try { const { page, limit } = paged(req); const where = { collectorId: req.user!.id }; const [items, total] = await Promise.all([prisma.collectionEntry.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.collectionEntry.count({ where })]); return ok(res, { items, total, page, totalPages: Math.ceil(total / limit) }); } catch (error) { next(error); } });
router.get('/collectors/me/reports', requireAuth('collector'), async (req, res, next) => { try { const entries = await prisma.collectionEntry.findMany({ where: { collectorId: req.user!.id }, select: { wasteType: true, weightKg: true } }); const totals = new Map<string, { totalKg: number; entries: number }>(); for (const entry of entries) { const current = totals.get(entry.wasteType) ?? { totalKg: 0, entries: 0 }; totals.set(entry.wasteType, { totalKg: current.totalKg + Number(entry.weightKg), entries: current.entries + 1 }); } return ok(res, [...totals].map(([_id, data]) => ({ _id, ...data }))); } catch (error) { next(error); } });

async function changeStatus(req: Request, res: Response, next: (error: unknown) => void, delegate: any, status: string, activityType: string) { try { const account = await delegate.update({ where: { id: req.params.id }, data: { status } }); await logActivity(req.user!.name ?? 'Admin', activityType, `${activityType}: ${account.fullName}`); return ok(res, publicAccount(account)); } catch (error) { next(error); } }
async function nextCollectorId() { const collectors = await prisma.garbageCollector.findMany({ select: { collectorId: true } }); const latest = collectors.map(({ collectorId }) => Number(collectorId.match(/^GC-(\d+)$/)?.[1] ?? 0)).sort((a, b) => b - a)[0] ?? 0; return `GC-${String(latest + 1).padStart(4, '0')}`; }
function bodyBirthdate() { return birthdate; }
function reportByPeriod(period: 'day' | 'month') { return async (_req: Request, res: Response, next: (error: unknown) => void) => { try { const entries = await prisma.collectionEntry.findMany({ select: { timestamp: true, weightKg: true } }); const totals = new Map<string, number>(); for (const entry of entries) { const date = entry.timestamp.toISOString(); const key = period === 'day' ? date.slice(0, 10) : date.slice(0, 7); totals.set(key, (totals.get(key) ?? 0) + Number(entry.weightKg)); } return ok(res, [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([_id, totalKg]) => ({ _id, totalKg }))); } catch (error) { next(error); } }; }