import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { JoinQueueInputSchema, BarberAvailabilityPatchSchema } from '@velora/shared';
import { runtimePool } from '../db/pool.js';
import { requireStaff } from '../middleware/auth.js';
import { StaffService, Actor } from '../services/staffService.js';
import { QueueService } from '../services/queueService.js';
import { emitQueueUpdated } from '../utils/events.js';
import { HttpError, sendError } from '../utils/httpErrors.js';
import { SalonService } from '../services/salonService.js';

export const staffRouter = Router();

const ALL_STAFF = ['RECEPTIONIST', 'BARBER', 'OWNER'] as const;
const FRONT_DESK = ['RECEPTIONIST', 'OWNER'] as const;

const uuid = z.string().uuid();
const actorOf = (req: Request): Actor => ({ id: req.staff!.sub, role: req.staff!.role, barberId: req.staff!.barberId });

function requireDb(_req: Request, res: Response, next: NextFunction): void {
  if (!runtimePool) {
    res.status(503).json({ error: 'Database is not configured on the server.' });
    return;
  }
  next();
}

staffRouter.use(requireDb);

// Wraps a handler: validates :id params as UUIDs, maps errors, never leaks internals.
const handle =
  (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      sendError(res, err);
    }
  };

const idParam = (req: Request, name = 'id'): string => {
  const r = uuid.safeParse(req.params[name]);
  if (!r.success) throw new HttpError(400, 'Invalid id');
  return r.data;
};

// GET /api/staff/queue — reception board (today's entries incl. phone numbers: staff only)
staffRouter.get(
  '/queue',
  requireStaff(...FRONT_DESK),
  handle(async (_req, res) => {
    res.json(await StaffService.getBoard());
  })
);

// GET /api/staff/barber/:barberId — barber phone view
staffRouter.get(
  '/barber/:barberId',
  requireStaff(...ALL_STAFF),
  handle(async (req, res) => {
    const barberId = idParam(req, 'barberId');
    const a = actorOf(req);
    if (a.role === 'BARBER' && a.barberId !== barberId) throw new HttpError(403, 'You can only view your own station.');
    res.json(await StaffService.getBarberView(barberId));
  })
);

// POST /api/staff/queue/call-next { barber_id }
staffRouter.post(
  '/queue/call-next',
  requireStaff(...ALL_STAFF),
  handle(async (req, res) => {
    const barberId = uuid.safeParse(req.body?.barber_id);
    if (!barberId.success) throw new HttpError(400, 'barber_id is required');
    const entry = await StaffService.callNext(barberId.data, actorOf(req));
    emitQueueUpdated({ action: entry ? 'called' : 'call_next_empty' });
    res.json({
      called: Boolean(entry),
      daily_token: entry?.daily_token ?? null,
      message: entry ? undefined : 'No compatible customer is waiting for this barber.',
    });
  })
);

staffRouter.post(
  '/queue/:id/start',
  requireStaff(...ALL_STAFF),
  handle(async (req, res) => {
    const e = await StaffService.startService(idParam(req), actorOf(req));
    emitQueueUpdated({ action: 'started' });
    res.json({ status: e.status, daily_token: e.daily_token });
  })
);

staffRouter.post(
  '/queue/:id/finish',
  requireStaff(...ALL_STAFF),
  handle(async (req, res) => {
    const e = await StaffService.finishService(idParam(req), actorOf(req));
    emitQueueUpdated({ action: 'finished' });
    res.json({ status: e.status, daily_token: e.daily_token });
  })
);

staffRouter.post(
  '/queue/:id/no-show',
  requireStaff(...ALL_STAFF),
  handle(async (req, res) => {
    const e = await StaffService.markNoShow(idParam(req), actorOf(req), req.body?.reason);
    emitQueueUpdated({ action: 'no_show' });
    res.json({ status: e.status, daily_token: e.daily_token });
  })
);

staffRouter.post(
  '/queue/:id/cancel',
  requireStaff(...FRONT_DESK),
  handle(async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : undefined;
    const e = await StaffService.cancelEntry(idParam(req), reason);
    emitQueueUpdated({ action: 'cancelled' });
    res.json({ status: e.status, daily_token: e.daily_token });
  })
);

// POST /api/staff/walk-in — same validation + duplicate-phone rule as online joining
staffRouter.post(
  '/walk-in',
  requireStaff(...FRONT_DESK),
  handle(async (req, res) => {
    const summary = await SalonService.getPublicSummary();
    if (!summary.salon.isOpen) {
      throw new HttpError(409, 'The salon is closed. Walk-ins cannot be added now.');
    }

    const parsed = JoinQueueInputSchema.safeParse({ ...req.body, is_walk_in: true });
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    const result = await QueueService.joinQueue(parsed.data);
    emitQueueUpdated({ action: result.isExisting ? 'duplicate_returned' : 'joined' });
    res.status(result.isExisting ? 200 : 201).json({
      isExisting: result.isExisting,
      daily_token: result.entry.daily_token,
      status: result.entry.status,
    });
  })
);

// PATCH /api/staff/barbers/:id/availability { status?, is_on_duty? }
staffRouter.patch(
  '/barbers/:id/availability',
  requireStaff(...ALL_STAFF),
  handle(async (req, res) => {
    const parsed = BarberAvailabilityPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Invalid availability change');
    const barber = await StaffService.setAvailability(idParam(req), parsed.data, actorOf(req));
    emitQueueUpdated({ action: 'barber_availability' });
    res.json(barber);
  })
);
