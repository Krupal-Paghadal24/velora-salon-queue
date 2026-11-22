import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminSettingsPatchSchema } from '@velora/shared';
import { runtimePool } from '../db/pool.js';
import { requireStaff } from '../middleware/auth.js';
import { AdminService } from '../services/adminService.js';
import { emitQueueUpdated } from '../utils/events.js';
import { HttpError, sendError } from '../utils/httpErrors.js';

export const adminRouter = Router();

adminRouter.use((_req: Request, res: Response, next: NextFunction) => {
  if (!runtimePool) {
    res.status(503).json({ error: 'Database is not configured on the server.' });
    return;
  }
  next();
});
adminRouter.use(requireStaff('OWNER'));

adminRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    res.json(await AdminService.getSettings());
  } catch (err) {
    sendError(res, err);
  }
});

adminRouter.patch('/settings', async (req: Request, res: Response) => {
  try {
    const parsed = AdminSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid settings');
    const result = await AdminService.updateSettings(parsed.data);
    emitQueueUpdated({ action: 'settings_changed' });
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

adminRouter.patch('/services/:id', async (req: Request, res: Response) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id);
    const body = z.object({ is_enabled: z.boolean() }).safeParse(req.body);
    if (!id.success || !body.success) throw new HttpError(400, 'Invalid request');
    await AdminService.setServiceEnabled(id.data, body.data.is_enabled);
    emitQueueUpdated({ action: 'settings_changed' });
    res.json(await AdminService.getSettings());
  } catch (err) {
    sendError(res, err);
  }
});
