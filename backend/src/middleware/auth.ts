import type { Request, Response, NextFunction } from 'express';
import type { StaffRole } from '@velora/shared';
import { verifyStaffToken, StaffTokenPayload } from '../utils/staffToken.js';

declare module 'express-serve-static-core' {
  interface Request {
    staff?: StaffTokenPayload;
  }
}

/** Requires a valid staff Bearer token whose role is in `roles` (any role if omitted). */
export function requireStaff(...roles: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token ? verifyStaffToken(token) : null;
    if (!payload) {
      res.status(401).json({ error: 'Please sign in again.' });
      return;
    }
    if (roles.length > 0 && !roles.includes(payload.role)) {
      res.status(403).json({ error: 'You do not have permission for this action.' });
      return;
    }
    req.staff = payload;
    next();
  };
}
