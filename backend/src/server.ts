import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDatabase } from './db.js';
import { config } from './config.js';
import { handleError } from './middleware.js';
import { router } from './routes.js';

const app = express();
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', router);
app.use(handleError);

connectDatabase()
  .then(() => app.listen(config.port, '0.0.0.0', () => console.log(`EcoTrack API listening on http://0.0.0.0:${config.port}`)))
  .catch((error) => { console.error('Database connection failed.', error); process.exit(1); });
