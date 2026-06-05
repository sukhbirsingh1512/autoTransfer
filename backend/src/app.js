import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '512kb' }));
  if (config.env === 'development') app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
