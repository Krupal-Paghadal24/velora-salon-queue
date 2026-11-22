import crypto from 'node:crypto';
import type { StaffRole } from '@velora/shared';
import { config } from '../config.js';

export interface StaffTokenPayload {
  sub: string;
  role: StaffRole;
  barberId: string | null;
  name: string;
  exp: number; // unix seconds
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(data).digest('base64url');
}

/** Parses values like "8h", "30m", "3600" into seconds. Defaults to 8 hours. */
export function parseExpirySeconds(value: string = config.JWT_EXPIRES_IN): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) return 8 * 3600;
  const n = parseInt(m[1], 10);
  const unit = m[2] || 's';
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit]!;
}

/** Stateless HMAC-SHA256 signed token (no external auth service, no extra dependency). */
export function signStaffToken(
  payload: Omit<StaffTokenPayload, 'exp'>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): { token: string; expiresIn: number } {
  const expiresIn = parseExpirySeconds();
  const body = b64url(JSON.stringify({ ...payload, exp: nowSeconds + expiresIn }));
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'VST' }));
  const unsigned = `${header}.${body}`;
  return { token: `${unsigned}.${sign(unsigned)}`, expiresIn };
}

export function verifyStaffToken(
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): StaffTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = sign(`${header}.${body}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as StaffTokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}
