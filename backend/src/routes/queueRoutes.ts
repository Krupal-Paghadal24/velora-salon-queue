import { Router, Request, Response } from 'express';
import { JoinQueueInputSchema } from '@velora/shared';
import { QueueService } from '../services/queueService.js';
import { emitQueueUpdated } from '../utils/events.js';
import { SalonService } from '../services/salonService.js';
import { StaffService } from '../services/staffService.js';
import { runtimePool } from '../db/pool.js';
import { config } from '../config.js';

export const queueRouter = Router();

// POST /api/queue/join — Customer or walk-in joins queue
queueRouter.post('/join', async (req: Request, res: Response) => {
  if (config.NODE_ENV === 'production' && !runtimePool) {
    res.status(503).json({ error: 'Queue persistence is unavailable. Please try again later.' });
    return;
  }

  const parsed = JoinQueueInputSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  try {
    // Server-side enforcement: owner can switch online joining off, and salon hours/cutoff apply.
    const summary = await SalonService.getPublicSummary();
    if (!summary.salon.isOnlineJoiningEnabled) {
      res.status(403).json({ error: 'Online joining is currently closed. Please speak to reception.' });
      return;
    }
    if (runtimePool) await StaffService.closeStaleEntries();

    // Public endpoint can never create walk-ins (those go through authenticated /api/staff/walk-in).
    const result = await QueueService.joinQueue({ ...parsed.data, is_walk_in: false });

    // Notify all open screens. Payload must never contain tracking ids or personal data.
    emitQueueUpdated({ action: result.isExisting ? 'duplicate_returned' : 'joined' });

    res.status(result.isExisting ? 200 : 201).json(result);
  } catch (err: any) {
    console.error('[Queue Join Error]:', err);
    res.status(500).json({
      error: err.message || 'Failed to join queue',
    });
  }
});

// GET /api/queue/:publicId — Retrieve private tracking details
queueRouter.get('/:publicId', async (req: Request, res: Response) => {
  const { publicId } = req.params;

  if (!publicId || publicId.length < 6) {
    res.status(400).json({ error: 'Invalid tracking ID' });
    return;
  }

  try {
    const entry = await QueueService.getQueueEntryByPublicId(publicId);

    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found or expired' });
      return;
    }

    // Never expose sequential internal DB id or sensitive customer details
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve queue entry' });
  }
});

// POST /api/queue/:publicId/cancel — Customer cancels their queue entry (strictly allowed while WAITING)
queueRouter.post('/:publicId/cancel', async (req: Request, res: Response) => {
  const { publicId } = req.params;
  const { reason } = req.body || {};

  if (!publicId || publicId.length < 6) {
    res.status(400).json({ error: 'Invalid tracking ID' });
    return;
  }

  try {
    const result = await QueueService.cancelQueueEntry(publicId, reason);

    // Broadcast queue cancellation to all screens
    emitQueueUpdated({ action: 'cancelled' });

    res.json(result);
  } catch (err: any) {
    const status = err.message && err.message.includes('not found') ? 404 : 400;
    res.status(status).json({
      error: err.message || 'Failed to cancel queue entry',
    });
  }
});
