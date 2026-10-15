import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { idParam, pagination } from '../validators.js';
import { computeSkipStreak, type SkipStreakEvent } from '../skipStreak.js';
import { list, logActivity, resolveReportReason } from './helpers.js';

export const escalationRoutes = Router();

// ─── Thresholds (one config place, constants only) ─────────────────────
export const SKIP_REMINDER_AT = 2;
export const SKIP_REVIEW_AT = 3;
export const SKIP_FOLLOW_UP_AT = 5;

export const ESCALATION_LIST_SELECT: Record<string, boolean> = {
  id: true, householdId: true, level: true, streak: true, streakStart: true,
  status: true, resolutionNote: true, dismissReason: true, actedBy: true,
  createdAt: true, updatedAt: true,
};

export type SkipDetail = {
  date: string;
  timestamp: string;
  collectorId: string | null;
  collectorName: string | null;
};

// ─── Thin database loader (pure counting lives in computeSkipStreak) ────
export async function loadSkipStreak(householdId: string): Promise<{
  archived: boolean;
  streak: number;
  streakStart: string | null;
  skips: SkipDetail[];
}> {
  const none = { archived: false, streak: 0, streakStart: null as string | null, skips: [] as SkipDetail[] };
  const household = await prisma.household.findUnique({ where: { householdId }, select: { status: true } });
  if (!household) return none;
  if (household.status === 'archived') return { ...none, archived: true };
  const [entries, notes] = await Promise.all([
    prisma.collectionEntry.findMany({
      where: { householdId },
      select: { timestamp: true },
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
    prisma.notification.findMany({
      where: {
        householdId,
        senderRole: 'collector',
        dismissedAt: null,
        OR: [{ reportReason: { not: null } }, { level: { startsWith: 'Report:' } }],
      },
      select: { createdAt: true, collectorId: true, senderName: true, level: true, reportReason: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);
  const skipNotes = notes.filter((note) => resolveReportReason(note.level, note.reportReason) === 'no_garbage_out');
  const events: SkipStreakEvent[] = [
    ...entries.map((entry) => ({ kind: 'collection' as const, timestamp: entry.timestamp })),
    ...skipNotes.map((note) => ({ kind: 'skip' as const, timestamp: note.createdAt })),
  ];
  const computed = computeSkipStreak(events);
  // Attach the collector behind each counted skip day (newest report that day).
  const byDay = new Map<string, { collectorId: string | null; collectorName: string | null; timestamp: Date }>();
  for (const note of skipNotes) {
    const day = new Date(new Date(note.createdAt).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!computed.skippedDates.includes(day) || byDay.has(day)) continue;
    byDay.set(day, { collectorId: note.collectorId, collectorName: note.senderName, timestamp: note.createdAt });
  }
  return {
    archived: false,
    streak: computed.streak,
    streakStart: computed.streakStart,
    skips: computed.skippedDates.map((date) => ({
      date,
      timestamp: (byDay.get(date)?.timestamp ?? new Date(date)).toISOString(),
      collectorId: byDay.get(date)?.collectorId ?? null,
      collectorName: byDay.get(date)?.collectorName ?? null,
    })),
  };
}

function startOfManilaDay(now = new Date()): Date {
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${manila}T00:00:00+08:00`);
}

// ─── Idempotent reconcile ──────────────────────────────────────────────
// Called from every path that can change the streak (report create/edit/
// dismiss, new collection). Never throws: callers wrap it, and it guards
// itself so a failure can't block saving a report or a collection.
export async function reconcileSkipEscalation(householdId: string, cause = 'streak changed'): Promise<void> {
  const live = await loadSkipStreak(householdId);
  if (live.archived || !live.streakStart) {
    // No live streak: close any open items (e.g. household archived, or a
    // collection ended the streak) without touching admin-handled rows.
    const openItems = await prisma.skipEscalation.findMany({ where: { householdId, status: 'open' } });
    for (const item of openItems) {
      await prisma.skipEscalation.update({
        where: { id: item.id },
        data: { status: 'resolved', resolutionNote: `Auto-closed: ${cause}; no active skip streak.`, actedBy: 'system' },
      });
      await logActivity('system', 'Escalation Auto-closed', `Auto-closed escalation ${item.id} for ${householdId}: ${cause}.`);
    }
    return;
  }
  const streakStart = new Date(live.streakStart);

  // 1. Auto-close / downgrade open items whose threshold no longer holds.
  const openItems = await prisma.skipEscalation.findMany({ where: { householdId, status: 'open' } });
  for (const item of openItems) {
    const threshold = item.level === 'follow_up' ? SKIP_FOLLOW_UP_AT : SKIP_REVIEW_AT;
    if (live.streak >= threshold) continue;
    if (item.level === 'follow_up' && live.streak >= SKIP_REVIEW_AT) {
      await prisma.skipEscalation.update({
        where: { id: item.id },
        data: { streak: live.streak, level: 'review', resolutionNote: `Auto-downgraded: streak dropped to ${live.streak} (${cause}).` },
      });
      await logActivity('system', 'Escalation Downgraded', `Downgraded escalation ${item.id} for ${householdId} to review (streak ${live.streak}).`);
    } else {
      await prisma.skipEscalation.update({
        where: { id: item.id },
        data: {
          status: 'resolved',
          resolutionNote: `Auto-closed: streak dropped to ${live.streak} (${cause}).`,
          actedBy: 'system',
        },
      });
      await logActivity('system', 'Escalation Auto-closed', `Auto-closed escalation ${item.id} for ${householdId}: streak ${live.streak} (${cause}).`);
    }
  }

  // 2. Duplicate report for the same household and day: streak already
  // reflects one skip per day, so ignore the trigger (report still saved).
  const todaysSkips = await prisma.notification.count({
    where: {
      householdId,
      senderRole: 'collector',
      dismissedAt: null,
      createdAt: { gte: startOfManilaDay() },
      OR: [
        { reportReason: 'no_garbage_out' },
        { reportReason: null, level: 'Report: Uncollected trash' },
        { reportReason: null, level: 'Report: No garbage out' },
      ],
    },
  });
  if (todaysSkips > 1) return;

  // 3. Friendly reminder at 2: at most one per streak — none if a Reminder
  // already exists after the latest CollectionEntry. Level 'Reminder'
  // deliberately contains no 'warning' substring.
  if (live.streak >= SKIP_REMINDER_AT) {
    const latestEntry = await prisma.collectionEntry.findFirst({
      where: { householdId },
      select: { timestamp: true },
      orderBy: { timestamp: 'desc' },
    });
    const reminderExists = await prisma.notification.findFirst({
      where: {
        householdId,
        level: 'Reminder',
        createdAt: { gt: latestEntry?.timestamp ?? new Date(0) },
      },
      select: { id: true },
    });
    if (!reminderExists) {
      await prisma.notification.create({
        data: {
          householdId,
          senderId: 'system',
          senderRole: 'system',
          senderName: 'EcoTrack',
          recipientType: 'household',
          title: 'Reminder: no collection this visit',
          message: `Our collector visited ${live.skips.length} time(s) recently and found no garbage put out. Please put your segregated garbage out on your purok's collection day so it gets collected.`,
          level: 'Reminder',
        },
      });
    }
  }

  // 4. Review at 3: never a new review item for a streak that already had
  // one in any status (matched by streakStart).
  if (live.streak >= SKIP_REVIEW_AT && live.streak < SKIP_FOLLOW_UP_AT) {
    const hadReview = await prisma.skipEscalation.findFirst({
      where: { householdId, level: 'review', streakStart },
    });
    if (!hadReview) {
      const created = await prisma.skipEscalation.create({
        data: { householdId, level: 'review', streak: live.streak, streakStart },
      });
      await logActivity('system', 'Escalation Created', `Created review escalation ${created.id} for ${householdId} (streak ${live.streak}).`);
    }
  }

  // 5. Follow-up at 5+: raise the open review for this streak, else one
  // follow_up item per streak (even if the review was resolved/dismissed).
  if (live.streak >= SKIP_FOLLOW_UP_AT) {
    const openReview = await prisma.skipEscalation.findFirst({
      where: { householdId, level: 'review', status: 'open', streakStart },
    });
    if (openReview) {
      await prisma.skipEscalation.update({
        where: { id: openReview.id },
        data: { level: 'follow_up', streak: live.streak },
      });
      await logActivity('system', 'Escalation Raised', `Raised escalation ${openReview.id} for ${householdId} to follow-up (streak ${live.streak}).`);
    } else {
      const hadFollowUp = await prisma.skipEscalation.findFirst({
        where: { householdId, level: 'follow_up', streakStart },
      });
      if (!hadFollowUp) {
        const created = await prisma.skipEscalation.create({
          data: { householdId, level: 'follow_up', streak: live.streak, streakStart },
        });
        await logActivity('system', 'Escalation Created', `Created follow-up escalation ${created.id} for ${householdId} (streak ${live.streak}).`);
      }
    }
  }

  // 6. Keep open items' stored streak fresh.
  await prisma.skipEscalation.updateMany({
    where: { householdId, status: 'open' },
    data: { streak: live.streak },
  });
}

// ─── Admin routes ──────────────────────────────────────────────────────

async function getEscalations(req: Request, res: Response, next: NextFunction) {
  try {
    const status = String(req.query.status ?? 'open');
    const where =
      status === 'all' ? {} : { status: status === 'resolved' || status === 'dismissed' ? status : 'open' };
    const result = await list(prisma.skipEscalation, req, where, ESCALATION_LIST_SELECT);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
}

async function getEscalationById(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.skipEscalation.findUnique({ where: { id: String(req.params.id) } });
    if (!item) return fail(res, 404, 'Escalation not found.');
    const live = await loadSkipStreak(item.householdId);
    return ok(res, { ...item, liveStreak: live.streak, skips: live.skips });
  } catch (error) {
    next(error);
  }
}

async function resolveEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.skipEscalation.findUnique({ where: { id: String(req.params.id) } });
    if (!item) return fail(res, 404, 'Escalation not found.');
    if (item.status !== 'open') return fail(res, 409, 'Escalation is already closed.');
    const updated = await prisma.skipEscalation.update({
      where: { id: item.id },
      data: {
        status: 'resolved',
        resolutionNote: req.body.note ? String(req.body.note).slice(0, 500) : null,
        actedBy: req.user!.name ?? 'Admin',
      },
    });
    await logActivity(req.user!.name ?? 'Admin', 'Escalation Resolved', `Resolved escalation ${item.id} for ${item.householdId}.`);
    return ok(res, updated, 'Escalation resolved.');
  } catch (error) {
    next(error);
  }
}

async function dismissEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await prisma.skipEscalation.findUnique({ where: { id: String(req.params.id) } });
    if (!item) return fail(res, 404, 'Escalation not found.');
    if (item.status !== 'open') return fail(res, 409, 'Escalation is already closed.');
    const reason = String(req.body.reason ?? '').trim();
    if (!reason) {
      return fail(res, 422, 'Validation failed.', [{ field: 'reason', message: 'A dismiss reason is required.' }]);
    }
    const updated = await prisma.skipEscalation.update({
      where: { id: item.id },
      data: { status: 'dismissed', dismissReason: reason.slice(0, 500), actedBy: req.user!.name ?? 'Admin' },
    });
    await logActivity(req.user!.name ?? 'Admin', 'Escalation Dismissed', `Dismissed escalation ${item.id} for ${item.householdId}: ${reason}.`);
    return ok(res, updated, 'Escalation dismissed.');
  } catch (error) {
    next(error);
  }
}

escalationRoutes.get('/escalations', requireAuth('admin'), pagination, validateRequest, getEscalations);
escalationRoutes.get('/escalations/:id', requireAuth('admin'), idParam, validateRequest, getEscalationById);
escalationRoutes.post('/escalations/:id/resolve', requireAuth('admin'), idParam, validateRequest, resolveEscalation);
escalationRoutes.post('/escalations/:id/dismiss', requireAuth('admin'), idParam, validateRequest, dismissEscalation);
