import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { config } from './config.js';
import { fail } from './response.js';
import { prisma } from './db.js';

export type Role = 'admin' | 'household' | 'collector';
type AuthUser = { id: string; role: Role; name?: string };

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

export function requireAuth(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    if (!token) return fail(res, 401, 'Authentication required.');
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
      if (!payload || typeof payload.id !== 'string' || !payload.role) return fail(res, 401, 'Invalid or expired token.');
      if (roles.length && !roles.includes(payload.role)) return fail(res, 403, 'Insufficient permissions.');
      // Revalidate account status so archived/inactive users lose access immediately,
      // not just at next login (JWTs are otherwise valid until expiry).
      try {
        const account =
          payload.role === 'admin'
            ? await prisma.admin.findFirst({ where: { OR: [{ id: payload.id }, { email: payload.id }] } })
            : payload.role === 'household'
              ? await prisma.household.findUnique({ where: { householdId: payload.id } })
              : await prisma.garbageCollector.findUnique({ where: { collectorId: payload.id } });
        if (!account) return fail(res, 401, 'Account no longer exists.');
        if ((account as { status?: string }).status === 'archived') return fail(res, 403, 'This account has been archived.');
        if ((account as { status?: string }).status === 'inactive') return fail(res, 403, 'This account is inactive.');
      } catch {
        // If the status lookup itself fails, fail closed rather than trusting a stale token.
        return fail(res, 503, 'Unable to verify account status. Please try again.');
      }
      req.user = payload;
      next();
    } catch {
      return fail(res, 401, 'Invalid or expired token.');
    }
  };
}

export function validateRequest(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err: { path?: unknown; param?: unknown; msg?: unknown }) => ({
      field: typeof err.path === 'string' ? err.path : typeof err.param === 'string' ? err.param : 'general',
      message: typeof err.msg === 'string' ? err.msg : 'Invalid value.',
    }));
    return fail(res, 422, 'Validation failed.', formattedErrors);
  }
  next();
}

export function handleError(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Map known Prisma errors to proper HTTP status codes instead of 500.
  const code = (error as { code?: string })?.code;
  if (code === 'P2002') {
    const fields = ((error as { meta?: { target?: string[] } })?.meta?.target ?? []).join(', ');
    return fail(
      res,
      409,
      fields ? `A record with this ${fields} already exists.` : 'A record with these details already exists.',
      fields ? [{ field: fields.split(', ')[0] ?? 'general', message: 'This value is already in use.' }] : undefined,
    );
  }
  if (code === 'P2025') {
    return fail(res, 404, 'Record not found.');
  }
  console.error(error);
  // Never leak internals (file paths, SQL, credentials) to clients — the
  // admin login page renders `message` verbatim. Full detail stays server-side.
  return fail(res, 500, 'Internal server error. Please try again.');
}
