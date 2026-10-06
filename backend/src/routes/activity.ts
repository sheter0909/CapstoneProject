import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../db.js';
import { ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { pagination } from '../validators.js';
import { list } from './helpers.js';
import type { Prisma } from '../generated/prisma/client.js';

export const activityRoutes = Router();

async function getActivityLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const status = String(req.query.status ?? 'all');
    const where: Prisma.ActivityLogWhereInput =
      status === 'success' || status === 'pending' || status === 'failed' ? { status } : {};
    return ok(res, await list(prisma.activityLog, req, where));
  } catch (error) {
    next(error);
  }
}

activityRoutes.get('/activity-logs', requireAuth('admin'), pagination, validateRequest, getActivityLogs);
