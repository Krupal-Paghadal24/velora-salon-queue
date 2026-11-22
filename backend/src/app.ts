import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { SALON_NAME, SALON_TIMEZONE, HealthResponse } from '@velora/shared';
import { salonRouter } from './routes/salonRoutes.js';
import { queueRouter } from './routes/queueRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { staffRouter } from './routes/staffRoutes.js';
import { displayRouter } from './routes/displayRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { runtimePool } from './db/pool.js';

export const app = express();

// Render/Vercel sit behind a proxy; needed so req.ip (login rate limit) is the client IP.
app.set('trust proxy', 1);

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or matching CORS_ORIGIN
      if (!origin || origin === config.CORS_ORIGIN || config.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Health Check Endpoint
app.get('/api/health', async (_req: Request, res: Response<HealthResponse>) => {
  let database: 'connected' | 'not_configured' | 'unavailable' = runtimePool
    ? 'connected'
    : 'not_configured';

  if (runtimePool) {
    try {
      await runtimePool.query('SELECT 1');
    } catch (err) {
      database = 'unavailable';
      console.error('[Health] PostgreSQL check failed:', err instanceof Error ? err.message : err);
    }
  }

  const persistent = database === 'connected';
  res.status(persistent || config.NODE_ENV !== 'production' ? 200 : 503).json({
    status: 'ok',
    salonName: config.DEFAULT_SALON_NAME || SALON_NAME,
    timezone: config.SALON_TIMEZONE || SALON_TIMEZONE,
    timestamp: new Date().toISOString(),
    database,
    persistent,
  });
});

// Mount Routes
app.use('/api/salon', salonRouter);
app.use('/api', salonRouter); // Exposes /api/services and /api/barbers directly
app.use('/api/queue', queueRouter);
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/display', displayRouter);
app.use('/api/admin', adminRouter);

// Centralized Error Handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err.message);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});
