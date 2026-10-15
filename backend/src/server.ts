import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDatabase, logDatabaseTarget, prisma } from './db.js';
import { config } from './config.js';
import { handleError } from './middleware.js';
import { ok, fail } from './response.js';
import { router } from './routes.js';
import { databaseErrorReason, logDatabaseError } from './dbDiagnostics.js';

const app = express();
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}
// Auto-allowed patterns: any eco-track.online subdomain, Vercel deploys, local dev.
const AUTO_ALLOW_PATTERNS: RegExp[] = [
  /^https:\/\/([a-z0-9-]+\.)*eco-track\.online$/,
  /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];
function isOriginAllowed(origin: string): boolean {
  const allowed = config.corsOrigins.map(normalizeOrigin);
  if (allowed.includes('*')) return true;
  const normalized = normalizeOrigin(origin);
  if (allowed.includes(normalized)) return true;
  return AUTO_ALLOW_PATTERNS.some((pattern) => pattern.test(normalized));
}
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isOriginAllowed(origin)) {
      callback(null, origin);
    } else {
      console.error(`Blocked CORS origin: ${origin} (allowed: ${config.corsOrigins.join(', ')})`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
const commit = (process.env.RENDER_GIT_COMMIT ?? 'local').slice(0, 7);
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'EcoTrack API', commit }));
app.get('/health', (_req, res) => res.json({ status: 'ok', commit }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', commit }));
// NOTE: Render uses /health as the platform health check — left untouched on
// purpose (never touches the database). /health/db is the opt-in liveness probe
// that runs SELECT 1. Callers invoke it fire-and-forget on login mount only;
// it is deliberately never polled on a server-side interval.
async function healthDb(_req: express.Request, res: express.Response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok(res, { status: 'ok', commit });
  } catch (error) {
    logDatabaseError('health check failed', error);
    return fail(res, 503, 'Database unavailable.', undefined, databaseErrorReason(error));
  }
}
app.get('/health/db', healthDb);
app.get('/api/health/db', healthDb);
app.use('/api', router);
app.use(handleError);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`EcoTrack API listening on http://0.0.0.0:${config.port}`);
  logDatabaseTarget();
  connectDatabase().catch((error) => logDatabaseError('startup connection failed', error));
});
