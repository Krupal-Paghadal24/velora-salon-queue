import { describe, it, expect } from 'vitest';
import { signStaffToken, verifyStaffToken, parseExpirySeconds } from '../src/utils/staffToken.js';

describe('staff token', () => {
  const payload = { sub: 'u1', role: 'OWNER' as const, barberId: null, name: 'Owner' };

  it('round-trips a valid token', () => {
    const { token } = signStaffToken(payload);
    expect(verifyStaffToken(token)?.sub).toBe('u1');
  });

  it('rejects tampered, malformed and expired tokens', () => {
    const { token } = signStaffToken(payload, 1000);
    expect(verifyStaffToken(token, 1000 + 60)).not.toBeNull();
    expect(verifyStaffToken(token, 1000 + 9 * 3600)).toBeNull(); // past 8h expiry
    const [h, b, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, role: 'OWNER', sub: 'attacker', exp: 9999999999 })).toString('base64url');
    expect(verifyStaffToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(verifyStaffToken('abc')).toBeNull();
    expect(verifyStaffToken(`${h}.${b}.`)).toBeNull();
  });

  it('parses expiry strings', () => {
    expect(parseExpirySeconds('8h')).toBe(28800);
    expect(parseExpirySeconds('30m')).toBe(1800);
    expect(parseExpirySeconds('bogus')).toBe(28800);
  });
});
