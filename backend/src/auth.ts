import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from './db.js';
import { config } from './config.js';
import type { Role } from './middleware.js';

type Account = { id: string; fullName?: string; name?: string; email?: string; householdId?: string; collectorId?: string; password: string; status?: string };

const ENCRYPTION_KEY = crypto.scryptSync(config.jwtSecret, 'ecotrack-password-salt', 32);

export function encryptPasswordDisplay(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

async function issueToken(id: string, role: Role, name?: string) {
  return jwt.sign({ id, role, name }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] });
}

export async function login(role: Role, identifier: string, rawPassword: string) {
  const trimmed = identifier.trim();
  // One typed query per role (no shared `any` delegate): a stale or partial
  // Prisma client fails here with a clear error instead of `undefined.findFirst`.
  let account: Account | null = null;
  if (role === 'admin') {
    account = await prisma.admin.findFirst({ where: { email: trimmed.toLowerCase() } });
  } else if (role === 'household') {
    account = await prisma.household.findFirst({ where: { householdId: trimmed } });
  } else {
    account = await prisma.garbageCollector.findFirst({ where: { collectorId: trimmed.toUpperCase() } });
  }
  if (!account || !(await bcrypt.compare(rawPassword, account.password))) return { error: 'Invalid credentials.' } as const;
  if (account.status === 'archived') return { error: 'This account has been archived.', forbidden: true } as const;
  if (account.status === 'inactive') return { error: 'This account is inactive.', forbidden: true } as const;
  const id = role === 'household'
    ? account.householdId!
    : role === 'collector'
      ? account.collectorId!
      : account.id;

  return {
    token: await issueToken(id, role, account.fullName ?? account.name),
    account: {
      id,
      role,
      fullName: account.fullName ?? account.name,
      name: account.fullName ?? account.name,
      email: account.email,
      householdId: account.householdId,
      collectorId: account.collectorId
    }
  } as const;
}

export async function hashPassword(rawPassword: string) { return bcrypt.hash(rawPassword, 12); }


