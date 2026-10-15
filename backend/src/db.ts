import 'dotenv/config';
import net from 'node:net';
import dns from 'node:dns';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { logDatabaseError } from './dbDiagnostics.js';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const databaseTarget = new URL(databaseUrl);
const databaseHost = databaseTarget.hostname;
const databaseName = decodeURIComponent(databaseTarget.pathname.replace(/^\/+/, '').split('/')[0] ?? '');

const adapter = new PrismaPg({ connectionString: databaseUrl });
export const prisma = new PrismaClient({ adapter });

export function logDatabaseTarget() {
  console.log(`[database] target host=${databaseHost} database=${databaseName || '(unspecified)'}`);

  const productionHost = process.env.PROD_DB_HOST?.trim().toLowerCase().replace(/\.$/, '');
  const currentHost = databaseHost.toLowerCase().replace(/\.$/, '');
  if (process.env.NODE_ENV !== 'production' && productionHost && currentHost === productionHost) {
    console.error(
      `!!! WARNING: non-production backend is configured to use the production database host (${databaseHost}).`,
    );
  }
}

export async function connectDatabase() {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log(`[database] connection successful host=${databaseHost} database=${databaseName || '(unspecified)'}`);
      return;
    } catch (error) {
      // Transient Neon startup errors (e.g. "Server has closed the connection")
      // self-heal with a short backoff instead of failing the whole boot.
      if (attempt >= maxAttempts) throw error;
      const delayMs = attempt * 1000;
      logDatabaseError(`connection attempt ${attempt}/${maxAttempts} failed; retrying in ${delayMs}ms`, error);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
