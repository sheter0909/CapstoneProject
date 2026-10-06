import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { created, fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { idParam, notificationFields, pagination } from '../validators.js';
import { list } from './helpers.js';

export const notificationRoutes = Router();

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

    if (recipientType === 'household') {
      const target = String(req.body.householdId ?? '').trim();
      if (!target) return fail(res, 400, 'householdId is required for household messages.');
      const exists = await prisma.household.findUnique({ where: { householdId: target } });
      if (!exists) return fail(res, 404, 'Target household not found.');
      householdId = exists.householdId;
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

    const notification = await prisma.notification.create({
      data: {
        householdId,
        collectorId,
        senderId: sender.id,
        senderRole: sender.role,
        senderName: sender.name ?? sender.role,
        recipientType,
        title,
        message,
        level,
      },
    });
    return created(res, notification, 'Notification sent.');
  } catch (error) {
    next(error);
  }
}

async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search ?? '').trim();
    const role = String(req.query.role ?? 'all');
    const where: Record<string, unknown> = {
      ...(role !== 'all' ? { senderRole: role } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { message: { contains: search, mode: 'insensitive' } },
              { senderName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return ok(res, await list(prisma.notification, req, where));
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
    const ownsAsHousehold =
      me.role === 'household' && (notification.householdId === me.id || (isBroadcast && notification.recipientType === 'all-households'));
    const ownsAsCollector =
      me.role === 'collector' && (notification.collectorId === me.id || (isBroadcast && notification.recipientType === 'all-collectors'));
    if (me.role !== 'admin' && !ownsAsHousehold && !ownsAsCollector) {
      return fail(res, 403, 'You are not authorized to access this notification.');
    }
    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
    return ok(res, updated, 'Notification marked as read.');
  } catch (error) {
    next(error);
  }
}

notificationRoutes.post('/notifications', requireAuth('admin', 'collector', 'household'), notificationFields, validateRequest, sendNotification);
notificationRoutes.get('/notifications', requireAuth('admin'), pagination, validateRequest, getNotifications);
notificationRoutes.patch('/notifications/:id/read', requireAuth('admin', 'collector', 'household'), idParam, validateRequest, markNotificationRead);
