import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { created, fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { idParam, notificationFields, pagination, editAnnouncementFields } from '../validators.js';
import { NOTIFICATION_LIST_SELECT, checkPurokMatch, list, logActivity, resolveReportReason, REPORT_REASONS, editableUntilFor, EDIT_WINDOW_HOURS } from './helpers.js';
import { reconcileSkipEscalation } from './escalations.js';
import { normalizePurokName } from './puroks.js';

export const notificationRoutes = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * @deprecated  Use normalizePurokName from puroks.ts for new code.
 *              Kept only for the legacy targetPurok string path.
 */
function normalizePurok(raw: string): string {
  return normalizePurokName(raw);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function sendNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const sender = req.user!;
    const recipientType = String(req.body.recipientType);
    const title = String(req.body.title).trim();
    const message = String(req.body.message).trim();
    const level = String(req.body.level ?? 'General').trim() || 'General';

    if (sender.role === 'collector' && (recipientType === 'collector' || recipientType === 'all-collectors')) {
      return fail(res, 403, 'Collectors can only send messages to households or broadcast to households.');
    }
    if (sender.role === 'household' && recipientType !== 'collector' && recipientType !== 'admin') {
      return fail(res, 403, 'Households can only send messages to a garbage collector or file a report to the admin.');
    }

    let householdId: string | null = null;
    let collectorId: string | null = null;
    let targetPurok: string | null = null;
    let targetPurokId: string | null = null;
    let reportReason: string | null = null;

    if (recipientType === 'household') {
      const target = String(req.body.householdId ?? '').trim();
      if (!target) return fail(res, 400, 'householdId is required for household messages.');
      const exists = await prisma.household.findUnique({ where: { householdId: target } });
      if (!exists) return fail(res, 404, 'Target household not found.');
      householdId = exists.householdId;

      // Collector household reports ("Report: ..." levels or an explicit
      // reportReason) are validated like collection logging; plain messages
      // from any role keep behaving exactly as before.
      const looksLikeReport =
        sender.role === 'collector' &&
        (String(req.body.reportReason ?? '').trim() !== '' || /^report:/i.test(String(req.body.level ?? '')));
      if (looksLikeReport) {
        const reason = resolveReportReason(req.body.level, req.body.reportReason);
        if (!reason) {
          return fail(res, 422, 'Validation failed.', [
            { field: 'reportReason', message: `Reason must be one of: ${(REPORT_REASONS as readonly string[]).join(', ')}.` },
          ]);
        }
        if (exists.status === 'archived') return fail(res, 404, 'Target household not found.');
        const collector = await prisma.garbageCollector.findUnique({ where: { collectorId: sender.id } });
        const purokError = checkPurokMatch(collector?.purokId, exists.purokId);
        if (purokError) return fail(res, 403, purokError);
        reportReason = reason;
      }
    }

    if (recipientType === 'collector') {
      // Collector login normalizes identifiers with toUpperCase (see auth.ts),
      // so normalize here too — otherwise a lowercase "gc-0003" would 404.
      const target = String(req.body.collectorId ?? '').trim().toUpperCase();
      if (!target) return fail(res, 400, 'collectorId is required for collector messages.');
      const exists = await prisma.garbageCollector.findFirst({ where: { collectorId: target } });
      if (!exists) return fail(res, 404, 'Target collector not found.');
      collectorId = exists.collectorId;
    }

    if (recipientType === 'purok-households' || recipientType === 'purok-collectors') {
      // Accept either a purokId (preferred) or the legacy targetPurok string.
      if (req.body.targetPurokId) {
        const purokId = String(req.body.targetPurokId).trim();
        const purok = await prisma.purok.findUnique({ where: { id: purokId } });
        if (!purok) return fail(res, 404, `Purok not found.`);
        targetPurokId = purok.id;
        targetPurok = purok.name; // keep legacy field in sync
      } else {
        const rawPurok = String(req.body.targetPurok ?? '').trim();
        if (!rawPurok) return fail(res, 400, 'targetPurokId (or targetPurok) is required for purok-targeted announcements.');
        const normalized = normalizePurok(rawPurok);
        const purok = await prisma.purok.findUnique({ where: { name: normalized } });
        if (!purok) {
          // Fall back to counting active members by the old free-text fields
          const householdsInPurok = await prisma.household.count({
            where: { purok: { equals: normalized, mode: 'insensitive' }, status: { not: 'archived' } },
          });
          const collectorsInPurok = await prisma.garbageCollector.count({
            where: { assignedArea: { equals: normalized, mode: 'insensitive' }, status: { not: 'archived' } },
          });
          if (householdsInPurok === 0 && collectorsInPurok === 0) {
            return fail(res, 404, `No active households or collectors found in "${normalized}".`);
          }
          targetPurok = normalized;
        } else {
          targetPurokId = purok.id;
          targetPurok = purok.name;
        }
      }
    }

    const notification = await prisma.notification.create({
      data: {
        householdId,
        collectorId,
        targetPurok,
        targetPurokId,
        senderId: sender.id,
        senderRole: sender.role,
        senderName: sender.name ?? sender.role,
        recipientType,
        title,
        message,
        level,
        ...(reportReason ? { reportReason } : {}),
      },
    });
    if (reportReason && householdId) {
      // Skip-streak escalation must never block saving the report.
      try {
        await reconcileSkipEscalation(householdId, 'report filed');
      } catch (reconcileError) {
        console.error('reconcileSkipEscalation failed after report create:', reconcileError);
      }
    }
    return created(res, notification, 'Notification sent.');
  } catch (error) {
    next(error);
  }
}

async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search ?? '').trim();
    const role = String(req.query.role ?? 'all');
    const purokFilter = String(req.query.purok ?? '').trim();
    // ?kind=report returns only collector-to-household report rows
    // (dismissed rows included), with real pagination. Optional
    // ?reason=no_garbage_out|dirty_surroundings|other narrows by reason,
    // mapping legacy "Report: ..." levels so old reports are not lost.
    const kind = String(req.query.kind ?? 'all').trim().toLowerCase();
    const reason = String(req.query.reason ?? '').trim();
    // Legacy levels that map to each reason (pre-reportReason rows).
    const legacyLevels: Record<string, string[]> = {
      no_garbage_out: ['Report: Uncollected trash', 'Report: No garbage out'],
      dirty_surroundings: ['Report: Contamination', 'Report: Dirty surroundings'],
    };
    let reasonClause: Record<string, unknown> | null = null;
    if (kind === 'report' && reason !== '') {
      if (reason === 'other') {
        reasonClause = {
          OR: [
            { reportReason: 'other' },
            {
              reportReason: null,
              level: { startsWith: 'Report:' },
              NOT: Object.values(legacyLevels).flat().map((level) => ({ level })),
            },
          ],
        };
      } else if (legacyLevels[reason]) {
        reasonClause = {
          OR: [{ reportReason: reason }, ...legacyLevels[reason].map((level) => ({ reportReason: null, level }))],
        };
      } else {
        return fail(res, 422, 'Validation failed.', [
          { field: 'reason', message: 'Reason must be one of: no_garbage_out, dirty_surroundings, other.' },
        ]);
      }
    }
    // Base shape of a collector-to-household report row (dismissed included).
    const reportBase = { OR: [{ reportReason: { not: null } }, { level: { startsWith: 'Report:' } }] };
    const where: Record<string, unknown> = {
      ...(role !== 'all' ? { senderRole: role } : {}),
      ...(purokFilter ? { targetPurok: { equals: normalizePurok(purokFilter), mode: 'insensitive' } } : {}),
      ...(kind === 'report'
        ? {
            senderRole: 'collector',
            recipientType: 'household',
            AND: reasonClause ? [reportBase, reasonClause] : [reportBase],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { message: { contains: search, mode: 'insensitive' } },
              { senderName: { contains: search, mode: 'insensitive' } },
              { householdId: { contains: search, mode: 'insensitive' } },
              { collectorId: { contains: search, mode: 'insensitive' } },
              { targetPurok: { contains: search, mode: 'insensitive' } },
              { recipientType: { contains: search, mode: 'insensitive' } },
              { level: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return ok(res, await list(prisma.notification, req, where, NOTIFICATION_LIST_SELECT));
  } catch (error) {
    next(error);
  }
}

async function updateAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) return fail(res, 404, 'Announcement not found.');

    const title = String(req.body.title).trim();
    const message = String(req.body.message).trim();
    const level = req.body.level !== undefined ? String(req.body.level).trim() || 'General' : existing.level;

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        title,
        message,
        level,
        editedAt: new Date(),
      },
    });

    const adminName = req.user?.name ?? 'Admin';
    await logActivity(
      adminName,
      'Announcement Updated',
      `Updated announcement "${updated.title}" (${updated.id})`,
    );

    return ok(res, updated, 'Announcement updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const me = req.user!;
    const notification = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
    if (!notification) return fail(res, 404, 'Notification not found.');
    const isBroadcast = notification.recipientType === 'all-households' || notification.recipientType === 'all-collectors';
    const isPurokHousehold = notification.recipientType === 'purok-households';
    const isPurokCollector = notification.recipientType === 'purok-collectors';

    const ownsAsHousehold =
      me.role === 'household' &&
      (notification.householdId === me.id ||
        (isBroadcast && notification.recipientType === 'all-households') ||
        isPurokHousehold); // purok ownership verified server-side at fetch time
    const ownsAsCollector =
      me.role === 'collector' &&
      (notification.collectorId === me.id ||
        (isBroadcast && notification.recipientType === 'all-collectors') ||
        isPurokCollector);

    if (me.role !== 'admin' && !ownsAsHousehold && !ownsAsCollector) {
      return fail(res, 403, 'You are not authorized to access this notification.');
    }
    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
    return ok(res, updated, 'Notification marked as read.');
  } catch (error) {
    next(error);
  }
}

// ─── Collector report edit / undo ──────────────────────────────────────────
// Edit and undo are allowed within EDIT_WINDOW_HOURS for the collector's own
// reports only. Undo sets dismissedAt (no hard delete) and writes an
// ActivityLog entry. Dismissed reports are excluded from household history
// and the violation count.

function ownReportOrError(req: Request, res: Response, note: { id: string; senderId: string; senderRole: string; createdAt: Date; dismissedAt: Date | null } | null) {
  if (!note) return fail(res, 404, 'Report not found.');
  if (note.senderRole !== 'collector' || note.senderId !== req.user!.id) {
    return fail(res, 403, 'You can only edit your own reports.');
  }
  if (Date.now() > editableUntilFor(note.createdAt).getTime()) {
    return fail(res, 403, `Edit window has expired (limit: ${EDIT_WINDOW_HOURS} hours).`);
  }
  if (note.dismissedAt) return fail(res, 409, 'This report was already withdrawn.');
  return null;
}

async function updateOwnReport(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
    const blocked = ownReportOrError(req, res, existing);
    if (blocked) return blocked;
    const reason = resolveReportReason(req.body.level, req.body.reportReason);
    if (req.body.reportReason !== undefined && !reason) {
      return fail(res, 422, 'Validation failed.', [
        { field: 'reportReason', message: `Reason must be one of: ${(REPORT_REASONS as readonly string[]).join(', ')}.` },
      ]);
    }
    const updated = await prisma.notification.update({
      where: { id: existing!.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.message !== undefined ? { message: String(req.body.message).trim() } : {}),
        ...(reason ? { reportReason: reason } : {}),
        editedAt: new Date(),
      },
    });
    if (updated.householdId) {
      try {
        await reconcileSkipEscalation(updated.householdId, 'report edited');
      } catch (reconcileError) {
        console.error('reconcileSkipEscalation failed after report edit:', reconcileError);
      }
    }
    return ok(res, updated, 'Report updated.');
  } catch (error) {
    next(error);
  }
}

async function dismissOwnReport(req: Request, res: Response, next: NextFunction) {  try {
    const existing = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
    const blocked = ownReportOrError(req, res, existing);
    if (blocked) return blocked;
    const updated = await prisma.notification.update({
      where: { id: existing!.id },
      data: { dismissedAt: new Date() },
    });
    await logActivity(req.user!.name ?? 'Collector', 'Report Withdrawn', `Withdrew report "${existing!.title}" (${existing!.id})`);
    if (updated.householdId) {
      try {
        await reconcileSkipEscalation(updated.householdId, 'report withdrawn');
      } catch (reconcileError) {
        console.error('reconcileSkipEscalation failed after report dismiss:', reconcileError);
      }
    }
    return ok(res, updated, 'Report withdrawn.');
  } catch (error) {
    next(error);
  }
}

// ─── Collector's own reports ─────────────────────────────────────────────
// Smallest list endpoint for the collector "My recent reports" section:
// collector only, own senderId, non-dismissed reports, newest first with
// editable/editableUntil computed from EDIT_WINDOW_HOURS.
async function listOwnReports(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await prisma.notification.findMany({
      where: {
        senderId: req.user!.id,
        senderRole: 'collector',
        dismissedAt: null,
        OR: [{ reportReason: { not: null } }, { level: { startsWith: 'Report:' } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return ok(
      res,
      items.map((note) => {
        const editableUntil = editableUntilFor(note.createdAt);
        return {
          ...note,
          reportReason: resolveReportReason(note.level, note.reportReason),
          editable: Date.now() <= editableUntil.getTime(),
          editableUntil: editableUntil.toISOString(),
        };
      }),
    );
  } catch (error) {
    next(error);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

notificationRoutes.post('/notifications', requireAuth('admin', 'collector', 'household'), notificationFields, validateRequest, sendNotification);
notificationRoutes.get('/notifications', requireAuth('admin'), pagination, validateRequest, getNotifications);
notificationRoutes.get('/notifications/my-reports', requireAuth('collector'), listOwnReports);
notificationRoutes.patch('/notifications/:id', requireAuth('admin'), idParam, editAnnouncementFields, validateRequest, updateAnnouncement);
notificationRoutes.patch('/announcements/:id', requireAuth('admin'), idParam, editAnnouncementFields, validateRequest, updateAnnouncement);
notificationRoutes.patch('/notifications/:id/read', requireAuth('admin', 'collector', 'household'), idParam, validateRequest, markNotificationRead);
notificationRoutes.put('/notifications/:id/report', requireAuth('collector'), idParam, validateRequest, updateOwnReport);
notificationRoutes.patch('/notifications/:id/dismiss', requireAuth('collector'), idParam, validateRequest, dismissOwnReport);
