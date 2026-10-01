import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDatabase } from './db.js';
import { config } from './config.js';
import { handleError } from './middleware.js';
import { router } from './routes.js';

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
app.use('/api', router);
app.use(handleError);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`EcoTrack API listening on http://0.0.0.0:${config.port}`);
  connectDatabase().catch((error) => console.error('Database connection failed.', error));
});
