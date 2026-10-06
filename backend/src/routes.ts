import { Router } from 'express';
import { activityRoutes } from './routes/activity.js';
import { authRoutes } from './routes/auth.js';
import { collectionRoutes } from './routes/collections.js';
import { collectorRoutes } from './routes/collectors.js';
import { householdRoutes } from './routes/households.js';
import { notificationRoutes } from './routes/notifications.js';
import { reportRoutes } from './routes/reports.js';

export const router = Router();

// Registration order mirrors the original single-file routes.ts so Express
// match precedence is unchanged (notably /households/me* before /households/:id).
router.use(authRoutes);
router.use(householdRoutes);
router.use(collectorRoutes);
router.use(activityRoutes);
router.use(reportRoutes);
router.use(collectionRoutes);
router.use(notificationRoutes);
