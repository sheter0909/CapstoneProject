import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { config } from './config.js';
import { fail } from './response.js';

export type Role = 'admin' | 'household' | 'collector';
export type AuthUser = { id: string; role: Role; name?: string };

declare global {
  namespace Express {
    interface Request { user?: AuthUser; }
  }
}

export function requireAuth(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    if (!token) return fail(res, 401, 'Authentication required.');
    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
      if (roles.length && !roles.includes(payload.role)) return fail(res, 403, 'Insufficient permissions.');
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
    const formattedErrors = errors.array().map((err: any) => ({
      field: err.path || err.param || 'general',
      message: err.msg || 'Invalid value.',
    }));
    return fail(res, 422, 'Validation failed.', formattedErrors);
  }
  next();
}

export function handleError(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(error);
  return fail(res, 500, 'Internal server error.');
}
