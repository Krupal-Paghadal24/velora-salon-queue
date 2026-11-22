import { Router, Request, Response } from 'express';
import { LoginInputSchema, LoginResponse, StaffRole } from '@velora/shared';
import { query, runtimePool } from '../db/pool.js';
import { verifyPassword } from '../utils/auth.js';
import { signStaffToken } from '../utils/staffToken.js';
import { requireStaff } from '../middleware/auth.js';
import { sendError } from '../utils/httpErrors.js';

export const authRouter = Router();

// Minimal in-memory brute-force guard: 10 failed logins per IP per 5 minutes.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILS = 10;
const WINDOW_MS = 5 * 60 * 1000;

// Used so unknown usernames cost the same time as wrong passwords.
const DUMMY_HASH = 'velorademosalt1234:' + '0'.repeat(128);

authRouter.post('/login', async (req: Request, res: Response) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const rec = attempts.get(key);
  if (rec && rec.resetAt > now && rec.count >= MAX_FAILS) {
    res.status(429).json({ error: 'Too many failed attempts. Please wait a few minutes.' });
    return;
  }

  const parsed = LoginInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }
  if (!runtimePool) {
    res.status(503).json({ error: 'Database is not configured on the server.' });
    return;
  }

  try {
    const r = await query<{
      id: string;
      username: string;
      password_hash: string;
      full_name: string;
      role: StaffRole;
      barber_id: string | null;
    }>('SELECT id, username, password_hash, full_name, role, barber_id FROM staff_users WHERE username = $1', [
      parsed.data.username.toLowerCase(),
    ]);
    const user = r.rows[0];
    const ok = verifyPassword(parsed.data.password, user ? user.password_hash : DUMMY_HASH) && !!user;

    if (!ok) {
      const cur = rec && rec.resetAt > now ? rec : { count: 0, resetAt: now + WINDOW_MS };
      cur.count += 1;
      attempts.set(key, cur);
      res.status(401).json({ error: 'Incorrect username or password.' });
      return;
    }

    attempts.delete(key);
    const { token, expiresIn } = signStaffToken({
      sub: user.id,
      role: user.role,
      barberId: user.barber_id,
      name: user.full_name,
    });
    const body: LoginResponse = {
      token,
      expires_in_seconds: expiresIn,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, barber_id: user.barber_id },
    };
    res.json(body);
  } catch (err) {
    sendError(res, err);
  }
});

authRouter.get('/me', requireStaff(), (req: Request, res: Response) => {
  const s = req.staff!;
  res.json({ id: s.sub, full_name: s.name, role: s.role, barber_id: s.barberId });
});
