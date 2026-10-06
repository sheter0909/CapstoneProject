import bcrypt from 'bcrypt';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { body } from 'express-validator';
import { prisma } from '../db.js';
import { hashPassword, login } from '../auth.js';
import { fail, ok } from '../response.js';
import { requireAuth, validateRequest } from '../middleware.js';
import { authLimiter, newResetToken, normalizeDateString, resetTokens } from './helpers.js';
import { login as loginFields, password } from '../validators.js';
import type { GarbageCollector, Household } from '../generated/prisma/client.js';

export const authRoutes = Router();

for (const role of ['admin', 'household', 'collector'] as const) {
  authRoutes.post(
    `/auth/${role}/login`,
    authLimiter,
    loginFields,
    validateRequest,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await login(role, String(req.body.identifier), String(req.body.password));
        if ('error' in result) {
          return fail(res, 'forbidden' in result && result.forbidden ? 403 : 401, result.error ?? 'Invalid credentials.');
        }
        return ok(res, result, 'Login successful.');
      } catch (error) {
        next(error);
      }
    },
  );
}

for (const role of ['household', 'collector'] as const) {
  authRoutes.post(
    `/auth/${role}/forgot-password`,
    authLimiter,
    [
      body('identifier').trim().notEmpty().withMessage('Account ID is required.'),
      body('birthdate').trim().notEmpty().withMessage('Birthdate is required.'),
      validateRequest,
    ],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const submittedBirthdate = normalizeDateString(req.body.birthdate);
        const identifier = String(req.body.identifier).trim();

        const account: Household | GarbageCollector | null =
          role === 'household'
            ? await prisma.household.findFirst({ where: { householdId: identifier } })
            : await prisma.garbageCollector.findFirst({ where: { collectorId: identifier.toUpperCase() } });

        if (!account) {
          return fail(res, 404, 'Account ID and birthdate do not match.');
        }

        const storedBirthdate = normalizeDateString(account.birthdate);
        if (!storedBirthdate || storedBirthdate !== submittedBirthdate) {
          return fail(res, 404, 'Account ID and birthdate do not match.');
        }

        const accountId = 'householdId' in account ? account.householdId : account.collectorId;
        const token = newResetToken();
        resetTokens.set(token, { role, accountId, expires: Date.now() + 15 * 60 * 1000 });
        return ok(res, { resetToken: token, accountId }, 'Identity verified.');
      } catch (error) {
        next(error);
      }
    },
  );

  authRoutes.post(
    `/auth/${role}/reset-password`,
    authLimiter,
    [body('resetToken').notEmpty().withMessage('Reset token is required.'), password, validateRequest],
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const reset = resetTokens.get(String(req.body.resetToken ?? '').trim());
        if (!reset || reset.role !== role || reset.expires < Date.now()) {
          if (reset && reset.expires < Date.now()) resetTokens.delete(String(req.body.resetToken ?? '').trim());
          return fail(res, 400, 'Reset token is invalid or expired.');
        }
        const account =
          role === 'household'
            ? await prisma.household.findFirst({ where: { householdId: reset.accountId } })
            : await prisma.garbageCollector.findFirst({ where: { collectorId: reset.accountId } });
        if (!account) return fail(res, 404, 'Account not found.');
        const hashed = await hashPassword(req.body.password);
        if (role === 'household') {
          await prisma.household.update({ where: { id: account.id }, data: { password: hashed } });
        } else {
          await prisma.garbageCollector.update({ where: { id: account.id }, data: { password: hashed } });
        }
        // Invalidate all outstanding reset tokens for this account, not just the used one.
        for (const [token, entry] of resetTokens) {
          if (entry.role === role && entry.accountId === reset.accountId) resetTokens.delete(token);
        }
        return ok(res, null, 'Password reset successfully.');
      } catch (error) {
        next(error);
      }
    },
  );
}

authRoutes.post(
  '/auth/collector/change-password',
  requireAuth('collector'),
  authLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  ],
  validateRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const account = await prisma.garbageCollector.findUnique({ where: { collectorId: req.user!.id } });
      if (!account || !(await bcrypt.compare(req.body.currentPassword, account.password))) {
        return fail(res, 401, 'Current password is incorrect.');
      }
      await prisma.garbageCollector.update({ where: { id: account.id }, data: { password: await hashPassword(req.body.newPassword) } });
      return ok(res, null, 'Password changed successfully.');
    } catch (error) {
      next(error);
    }
  },
);
