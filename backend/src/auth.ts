import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from './db.js';
import { config } from './config.js';
import type { Role } from './middleware.js';

const models: Record<Role, any> = { admin: prisma.admin, household: prisma.household, collector: prisma.garbageCollector };

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

export function decryptPasswordDisplay(encryptedData: string | null | undefined): string {
  if (!encryptedData) return '';
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) return '';
    const [ivHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

export async function issueToken(id: string, role: Role, name?: string) {
  return jwt.sign({ id, role, name }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] });
}

export async function login(role: Role, identifier: string, rawPassword: string) {
  const Model = models[role];
  const field = role === 'admin' ? { email: identifier.toLowerCase() } : role === 'household' ? { householdId: identifier } : { collectorId: identifier.toUpperCase() };
  const account = await Model.findFirst({ where: field }) as Account | null;
  if (!account || !(await bcrypt.compare(rawPassword, account.password))) return { error: 'Invalid credentials.' } as const;
  if (account.status === 'archived') return { error: 'This account has been archived.' } as const;
  if (account.status === 'inactive') return { error: 'This account is inactive.' } as const;
  const id = role === 'household' ? account.householdId! : role === 'collector' ? account.collectorId! : account.id;
  return { token: await issueToken(id, role, account.fullName ?? account.name), account: { id, role, name: account.fullName ?? account.name, email: account.email, householdId: account.householdId, collectorId: account.collectorId } } as const;
}

export async function hashPassword(rawPassword: string) { return bcrypt.hash(rawPassword, 12); }

