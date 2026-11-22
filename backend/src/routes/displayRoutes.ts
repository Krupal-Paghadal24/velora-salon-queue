import { Router, Request, Response } from 'express';
import { runtimePool } from '../db/pool.js';
import { DisplayService } from '../services/displayService.js';
import { sendError } from '../utils/httpErrors.js';

export const displayRouter = Router();

// GET /api/display — public, anonymised TV payload (tokens + barber names only)
displayRouter.get('/', async (_req: Request, res: Response) => {
  if (!runtimePool) {
    res.status(503).json({ error: 'Database is not configured on the server.' });
    return;
  }
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await DisplayService.getDisplay());
  } catch (err) {
    sendError(res, err);
  }
});
