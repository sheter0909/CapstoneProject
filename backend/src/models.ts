import { prisma } from './db.js';

export const Household = prisma.household;
export const GarbageCollector = prisma.garbageCollector;
export const Admin = prisma.admin;
export const CollectionEntry = prisma.collectionEntry;
export const Notification = prisma.notification;
export const ActivityLog = prisma.activityLog;
