import { Router, Request, Response } from 'express';
import { SalonService } from '../services/salonService.js';

export const salonRouter = Router();

// GET /api/salon/status — Public summary for Home and live status
salonRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const summary = await SalonService.getPublicSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch salon summary' });
  }
});

// GET /api/services — Available enabled services
salonRouter.get('/services', async (_req: Request, res: Response) => {
  try {
    const services = await SalonService.getServices();
    res.json(services);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch services' });
  }
});

// GET /api/barbers — On-duty barbers
salonRouter.get('/barbers', async (_req: Request, res: Response) => {
  try {
    const barbers = await SalonService.getBarbers();
    res.json(barbers);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch barbers' });
  }
});
