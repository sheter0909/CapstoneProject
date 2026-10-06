import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { fail, ok } from '../response.js';
import type { AccountStatus, GarbageCollector, Household, Prisma } from '../generated/prisma/client.js';

export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', message: { success: false, message: 'Too many attempts. Try again later.' } });
export const resetTokens = new Map<string, { role: 'household' | 'collector'; accountId: string; expires: number }>();
export type ActivityStatusValue = 'success' | 'pending' | 'failed';

export function paged(req: Request) {
  // Clamp invalid input: ?page=abc previously produced skip:NaN -> Prisma throw -> HTTP 500.
  const rawPage = Number(req.query.page ?? 1);
  const rawLimit = Number(req.query.limit ?? 20);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
  return { page, limit };
}

export type ListDelegate<Item, Where> = {
  findMany(args: { where: Where; orderBy: { createdAt: 'desc' }; skip: number; take: number }): Promise<Item[]>;
  count(args: { where: Where }): Promise<number>;
};

export async function list<Item, Where>(
  delegate: ListDelegate<Item, Where>,
  req: Request,
  where: Where,
): Promise<{ items: Item[]; total: number; page: number; totalPages: number }> {
  const { page, limit } = paged(req);
  const [items, total] = await Promise.all([
    delegate.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    delegate.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

export async function logActivity(user: string, activityType: string, description: string, status: ActivityStatusValue = 'success') { await prisma.activityLog.create({ data: { user, activityType, description, status } }); }

export function publicAccount<T extends object>(account: T): Omit<T, 'password' | 'passwordDisplay'> {
  const safeAccount = { ...account };
  delete (safeAccount as Record<string, unknown>).password;
  delete (safeAccount as Record<string, unknown>).passwordDisplay;
  return safeAccount;
}
// Admin views no longer receive reversible plaintext passwords. The stored
// passwordDisplay column is write-only now; admins rotate via update instead.
export function adminHousehold(account: Household) { return publicAccount(account); }
export function adminCollector(account: GarbageCollector) { return publicAccount(account); }
// Informational only: how many Warning-level notifications a household has received.
export async function violationCounts(householdIds: string[]): Promise<Record<string, number>> {
  if (householdIds.length === 0) return {};
  const grouped = await prisma.notification.groupBy({ by: ['householdId'], where: { householdId: { in: householdIds }, level: { contains: 'warning', mode: 'insensitive' } }, _count: { householdId: true } });
  return Object.fromEntries(grouped.map((row) => [row.householdId, row._count.householdId]));
}
export function purgeExpiredResetTokens() { const now = Date.now(); for (const [token, reset] of resetTokens) { if (reset.expires < now) resetTokens.delete(token); } }
export function newResetToken() { purgeExpiredResetTokens(); return crypto.randomBytes(32).toString('hex'); }
export const EDIT_WINDOW_HOURS = Number(process.env.EDIT_WINDOW_HOURS ?? 24) || 24;
export function editableUntilFor(timestamp: Date): Date { return new Date(timestamp.getTime() + EDIT_WINDOW_HOURS * 60 * 60 * 1000); }
export function withEditable<T extends { timestamp: Date; collectorId: string }>(entry: T, collectorId: string): T & { editable: boolean; editableUntil: string } {
  const editableUntil = editableUntilFor(entry.timestamp);
  return { ...entry, editable: entry.collectorId === collectorId && Date.now() <= editableUntil.getTime(), editableUntil: editableUntil.toISOString() };
}
export function warningLevelForCount(count: number): string { if (count <= 1) return 'First Warning'; if (count === 2) return 'Second Warning'; return 'Final Warning'; }
export function nextWarningLevelForCount(count: number): string { return warningLevelForCount(count + 1); }
export function warningOrdinal(count: number): string { if (count === 1) return 'first'; if (count === 2) return 'second'; if (count === 3) return 'third'; return `${count}th`; }
export function buildWarningText(level: string, count: number, timestamp: Date, weightKg: unknown): { title: string; message: string } {
  const date = timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const kg = Number(weightKg);
  const title = `Garbage Not Segregated - ${level}`.slice(0, 120);
  const message = `Your garbage collected on ${date} (${Number.isFinite(kg) ? kg : weightKg} kg) was not segregated. This is your ${warningOrdinal(count)} warning (${level}). Please separate biodegradable, recyclable and non-biodegradable waste.`.slice(0, 2000);
  return { title, message };
}

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

export type StatusDelegate = {
  findUnique(args: { where: { id: string } }): Promise<{ id: string; fullName: string } | null>;
  update(args: { where: { id: string }; data: { status: AccountStatus } }): Promise<{ id: string; fullName: string }>;
};

export async function changeStatus(req: Request, res: Response, next: NextFunction, delegate: StatusDelegate, status: AccountStatus, activityType: string) {
  try {
    const recordId = String(req.params.id);
    const existing = await delegate.findUnique({ where: { id: recordId } });
    if (!existing) return fail(res, 404, 'Record not found.');
    const account = await delegate.update({ where: { id: recordId }, data: { status } });
    await logActivity(req.user!.name ?? 'Admin', activityType, `${activityType}: ${account.fullName}`);
    return ok(res, publicAccount(account));
  } catch (error) {
    next(error);
  }
}

export async function nextCollectorId() { const collectors = await prisma.garbageCollector.findMany({ select: { collectorId: true } }); const latest = collectors.map(({ collectorId }) => Number(collectorId.match(/^GC-(\d+)$/)?.[1] ?? 0)).sort((a, b) => b - a)[0] ?? 0; return `GC-${String(latest + 1).padStart(4, '0')}`; }

export function reportByPeriod(period: 'day' | 'month') { return async (_req: Request, res: Response, next: NextFunction) => { try { const entries = await prisma.collectionEntry.findMany({ select: { timestamp: true, weightKg: true } }); const totals = new Map<string, number>(); for (const entry of entries) { // Bucket in Philippines time (UTC+8, no DST): toISOString() is UTC, so an evening
      // collection in PH previously landed in the next UTC day/month bucket.
      const phTime = new Date(entry.timestamp.getTime() + 8 * 60 * 60 * 1000); const date = phTime.toISOString(); const key = period === 'day' ? date.slice(0, 10) : date.slice(0, 7); totals.set(key, (totals.get(key) ?? 0) + Number(entry.weightKg)); } return ok(res, [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([_id, totalKg]) => ({ _id, totalKg }))); } catch (error) { next(error); } }; }
