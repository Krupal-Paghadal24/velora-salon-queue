/**
 * End-to-end API tests against a REAL PostgreSQL database.
 * Skipped unless TEST_DATABASE_URL is set. WARNING: this test TRUNCATES queue tables
 * in that database - point it at a throwaway/local database only, never production.
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/velora_test npm test
 * (the database must already have migrations + seed applied: npm run db:migrate && npm run db:seed)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const TEST_DB = process.env.TEST_DATABASE_URL;

const AARAV = '22222222-2222-2222-2222-222222222201';
const ROHAN = '22222222-2222-2222-2222-222222222202';
const VIKRAM = '22222222-2222-2222-2222-222222222203';
const SVC1 = '11111111-1111-1111-1111-111111111101'; // 30 min
const SVC2 = '11111111-1111-1111-1111-111111111102'; // 20 min

describe.skipIf(!TEST_DB)('Staff, display & admin flow (real PostgreSQL)', () => {
  let base = '';
  let server: Server;
  let pool: any;
  let StaffService: any;
  const tokens: Record<string, string> = {};

  async function api(method: string, path: string, body?: unknown, token?: string) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, json, text };
  }

  async function login(username: string) {
    const r = await api('POST', '/api/auth/login', { username, password: 'demo123' });
    expect(r.status).toBe(200);
    tokens[username] = r.json.token;
  }

  beforeAll(async () => {
    process.env.TEST_DATABASE_URL = TEST_DB;
    process.env.NODE_ENV = 'test';
    const dbMod = await import('../src/db/pool.js');
    pool = dbMod.runtimePool;
    if (!pool) throw new Error('TEST_DATABASE_URL did not configure the isolated test database.');
    const { config } = await import('../src/config.js');
    const testTarget = new URL(config.TEST_DATABASE_URL!);
    const runtimeTarget = config.DATABASE_URL ? new URL(config.DATABASE_URL) : null;
    if (
      runtimeTarget &&
      testTarget.hostname === runtimeTarget.hostname &&
      testTarget.pathname === runtimeTarget.pathname
    ) {
      throw new Error('TEST_DATABASE_URL must not point to the configured runtime database.');
    }
    await pool.query(
      `TRUNCATE queue_status_logs, queue_entry_services, queue_entries, daily_token_counters RESTART IDENTITY CASCADE`
    );
    await pool.query(`UPDATE barbers SET status = 'AVAILABLE', is_on_duty = true`);
    await pool.query(`UPDATE barbers SET status = 'ON_BREAK' WHERE id = $1`, [VIKRAM]);
    await pool.query(`UPDATE salon_settings SET is_online_joining_enabled = true, opening_time='00:00', closing_time='23:59', online_cutoff_minutes=0`);
    await pool.query(`UPDATE services SET is_enabled = true`);

    const { app } = await import('../src/app.js');
    StaffService = (await import('../src/services/staffService.js')).StaffService;
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    for (const u of ['owner', 'reception', 'aarav', 'rohan']) await login(u);
  });

  afterAll(async () => {
    server?.close();
    await pool?.end();
  });

  it('rejects bad logins and unauthenticated / wrong-role access', async () => {
    expect((await api('POST', '/api/auth/login', { username: 'owner', password: 'wrong' })).status).toBe(401);
    expect((await api('GET', '/api/staff/queue')).status).toBe(401);
    expect((await api('GET', '/api/staff/queue', undefined, 'garbage.token.here')).status).toBe(401);
    expect((await api('GET', '/api/staff/queue', undefined, tokens.aarav)).status).toBe(403); // barber
    expect((await api('GET', '/api/admin/settings', undefined, tokens.reception)).status).toBe(403);
    expect((await api('GET', '/api/auth/me', undefined, tokens.owner)).json.role).toBe('OWNER');
  });

  it('runs the full queue lifecycle with correct compatibility, estimates and permissions', async () => {
    // Walk-ins by reception (T1 Any, T2 prefers Rohan) + online join (T3 Any)
    const w1 = await api('POST', '/api/staff/walk-in', { customer_name: 'Ramesh Patel', customer_phone: '9876500001', service_ids: [SVC1] }, tokens.reception);
    const w2 = await api('POST', '/api/staff/walk-in', { customer_name: 'Pooja Shah', customer_phone: '9876500002', service_ids: [SVC2], preferred_barber_id: ROHAN }, tokens.reception);
    expect(w1.status).toBe(201);
    expect(w2.status).toBe(201);
    expect([w1.json.daily_token, w2.json.daily_token]).toEqual([1, 2]);

    const dup = await api('POST', '/api/staff/walk-in', { customer_name: 'Ramesh Patel', customer_phone: '98765 00001', service_ids: [SVC1] }, tokens.reception);
    expect(dup.status).toBe(200);
    expect(dup.json.isExisting).toBe(true);
    expect(dup.json.daily_token).toBe(1);

    const online = await api('POST', '/api/queue/join', { customer_name: 'Dhaval Mehta', customer_phone: '9876500003', service_ids: [SVC1, SVC2], is_walk_in: true });
    expect(online.status).toBe(201);
    const publicId: string = online.json.entry.public_id;
    expect(online.json.entry.is_walk_in).toBe(false); // client cannot forge walk-in

    // Customer tracking: real position + estimate (T3 Any: 2 ahead; 3 barbers on duty incl. on-break one)
    const track = await api('GET', `/api/queue/${publicId}`);
    expect(track.status).toBe(200);
    expect(track.json.status).toBe('WAITING');
    expect(track.json.position_ahead).toBe(2);
    expect(typeof track.json.estimated_wait_minutes).toBe('number');
    expect(track.json.estimated_wait_minutes).toBeGreaterThan(0);

    // Board
    let board = (await api('GET', '/api/staff/queue', undefined, tokens.reception)).json;
    expect(board.stats.waiting).toBe(3);
    expect(board.barbers).toHaveLength(4);

    // Call next: Aarav gets T1; second call for same barber is rejected
    const c1 = await api('POST', '/api/staff/queue/call-next', { barber_id: AARAV }, tokens.reception);
    expect(c1.status).toBe(200);
    expect(c1.json.daily_token).toBe(1);
    expect((await api('POST', '/api/staff/queue/call-next', { barber_id: AARAV }, tokens.reception)).status).toBe(409);

    // Break is refused while a customer is called
    expect((await api('PATCH', `/api/staff/barbers/${AARAV}/availability`, { status: 'ON_BREAK' }, tokens.aarav)).status).toBe(409);
    // Vikram is on break -> cannot be called
    expect((await api('POST', '/api/staff/queue/call-next', { barber_id: VIKRAM }, tokens.reception)).status).toBe(409);

    board = (await api('GET', '/api/staff/queue', undefined, tokens.reception)).json;
    const t1 = board.entries.find((e: any) => e.daily_token === 1);
    expect(t1.status).toBe('CALLED');

    // Barber permissions: Rohan cannot act on Aarav's customer or station; Aarav can
    expect((await api('POST', `/api/staff/queue/${t1.id}/start`, undefined, tokens.rohan)).status).toBe(403);
    expect((await api('POST', '/api/staff/queue/call-next', { barber_id: AARAV }, tokens.rohan)).status).toBe(403);
    expect((await api('GET', `/api/staff/barber/${AARAV}`, undefined, tokens.rohan)).status).toBe(403);
    // Cannot finish before starting
    expect((await api('POST', `/api/staff/queue/${t1.id}/finish`, undefined, tokens.aarav)).status).toBe(409);

    expect((await api('POST', `/api/staff/queue/${t1.id}/start`, undefined, tokens.aarav)).status).toBe(200);
    const view = (await api('GET', `/api/staff/barber/${AARAV}`, undefined, tokens.aarav)).json;
    expect(view.active.daily_token).toBe(1);
    expect(view.active.status).toBe('IN_SERVICE');
    expect(view.next.daily_token).toBe(3); // T2 prefers Rohan, so Aarav's next compatible is T3
    expect(JSON.stringify(view)).not.toContain('+91');

    // Rohan's next compatible is T2 (earliest, requested him)
    const rv = (await api('GET', `/api/staff/barber/${ROHAN}`, undefined, tokens.rohan)).json;
    expect(rv.next.daily_token).toBe(2);
    const c2 = await api('POST', '/api/staff/queue/call-next', { barber_id: ROHAN }, tokens.rohan);
    expect(c2.json.daily_token).toBe(2);

    // Customer status reflects the state; customer can no longer cancel a called/waiting-protected entry
    // (T3 still waiting: now position 0)
    const track2 = await api('GET', `/api/queue/${publicId}`);
    expect(track2.json.position_ahead).toBe(0);

    // Reception: cannot cancel a CALLED customer (use no-show); no-show frees Rohan
    const t2 = (await api('GET', '/api/staff/queue', undefined, tokens.reception)).json.entries.find((e: any) => e.daily_token === 2);
    expect((await api('POST', `/api/staff/queue/${t2.id}/cancel`, {}, tokens.reception)).status).toBe(409);
    await pool.query(`UPDATE queue_entries SET called_at = CURRENT_TIMESTAMP - INTERVAL '11 minutes' WHERE id = $1`, [t2.id]);
    expect((await api('POST', `/api/staff/queue/${t2.id}/no-show`, {}, tokens.reception)).status).toBe(200);

    // Finish T1 -> Aarav available again
    expect((await api('POST', `/api/staff/queue/${t1.id}/finish`, undefined, tokens.aarav)).status).toBe(200);
    const c3 = await api('POST', '/api/staff/queue/call-next', { barber_id: AARAV }, tokens.aarav);
    expect(c3.json.daily_token).toBe(3);

    // Customer tracking shows CALLED + assigned barber; self-cancel now refused
    const track3 = await api('GET', `/api/queue/${publicId}`);
    expect(track3.json.status).toBe('CALLED');
    expect(track3.json.assigned_barber_name).toBe('Aarav Patel');
    expect((await api('POST', `/api/queue/${publicId}/cancel`, {})).status).toBe(400);

    // Empty queue -> clear message, no error
    const empty = await api('POST', '/api/staff/queue/call-next', { barber_id: ROHAN }, tokens.reception);
    expect(empty.status).toBe(200);
    expect(empty.json.called).toBe(false);

    // Customer self-cancel while waiting + staff cancel while waiting
    const w4 = await api('POST', '/api/queue/join', { customer_name: 'Kiran Joshi', customer_phone: '9876500004', service_ids: [SVC1] });
    const cancel = await api('POST', `/api/queue/${w4.json.entry.public_id}/cancel`, {});
    expect(cancel.status).toBe(200);
    const w5 = await api('POST', '/api/staff/walk-in', { customer_name: 'Hetal Desai', customer_phone: '9876500005', service_ids: [SVC1] }, tokens.reception);
    const t5 = (await api('GET', '/api/staff/queue', undefined, tokens.reception)).json.entries.find((e: any) => e.daily_token === w5.json.daily_token);
    expect((await api('POST', `/api/staff/queue/${t5.id}/cancel`, {}, tokens.reception)).status).toBe(200);

    // Break toggle on/off for a free barber (own station) and cross-barber refusal
    expect((await api('PATCH', `/api/staff/barbers/${ROHAN}/availability`, { status: 'ON_BREAK' }, tokens.rohan)).json.status).toBe('ON_BREAK');
    expect((await api('PATCH', `/api/staff/barbers/${ROHAN}/availability`, { status: 'AVAILABLE' }, tokens.aarav)).status).toBe(403);
    expect((await api('PATCH', `/api/staff/barbers/${ROHAN}/availability`, { is_on_duty: false }, tokens.rohan)).status).toBe(403);
    expect((await api('PATCH', `/api/staff/barbers/${ROHAN}/availability`, { status: 'AVAILABLE' }, tokens.rohan)).json.status).toBe('AVAILABLE');
  });

  it('TV display is anonymised and live', async () => {
    const d = await api('GET', '/api/display');
    expect(d.status).toBe(200);
    const raw = d.text;
    for (const secret of ['Ramesh', 'Pooja', 'Dhaval', 'Hetal', '+91', '98765', 'customer_', 'public_id']) {
      expect(raw).not.toContain(secret);
    }
    const aarav = d.json.stations.find((s: any) => s.barber_name === 'Aarav Patel');
    expect(aarav.state).toBe('CALLED');
    expect(aarav.token).toBe(3);
    expect(d.json.stations.find((s: any) => s.barber_name === 'Vikram Dave').state).toBe('ON_BREAK');
  });

  it('owner settings: validation, role guard, online-joining enforcement, service toggle', async () => {
    expect((await api('PATCH', '/api/admin/settings', { is_online_joining_enabled: false }, tokens.reception)).status).toBe(403);
    expect((await api('PATCH', '/api/admin/settings', { opening_time: '20:00', closing_time: '09:00' }, tokens.owner)).status).toBe(400);
    expect((await api('PATCH', '/api/admin/settings', { opening_time: '9am' }, tokens.owner)).status).toBe(400);

    const off = await api('PATCH', '/api/admin/settings', { is_online_joining_enabled: false }, tokens.owner);
    expect(off.status).toBe(200);
    expect(off.json.settings.is_online_joining_enabled).toBe(false);
    const blocked = await api('POST', '/api/queue/join', { customer_name: 'Blocked User', customer_phone: '9876500009', service_ids: [SVC1] });
    expect(blocked.status).toBe(403);
    // walk-ins by reception still work while online joining is off
    expect((await api('POST', '/api/staff/walk-in', { customer_name: 'Walkin Okay', customer_phone: '9876500010', service_ids: [SVC1] }, tokens.reception)).status).toBe(201);
    await api('PATCH', '/api/admin/settings', { is_online_joining_enabled: true }, tokens.owner);

    const dis = await api('PATCH', `/api/admin/services/${SVC2}`, { is_enabled: false }, tokens.owner);
    expect(dis.json.services.find((s: any) => s.id === SVC2).is_enabled).toBe(false);
    const svcList = await api('GET', '/api/services');
    expect(svcList.json.find((s: any) => s.id === SVC2)).toBeUndefined();
    await api('PATCH', `/api/admin/services/${SVC2}`, { is_enabled: true }, tokens.owner);
  });

  it('closes entries left over from a previous salon day', async () => {
    await pool.query(
      `INSERT INTO queue_entries (public_id, daily_token, salon_date, customer_name, customer_phone, status, total_duration_minutes, total_price_inr)
       VALUES ('stale-entry-0001-x', 99, CURRENT_DATE - 3, 'Old Customer', '+919000000001', 'WAITING', 30, 350)`
    );
    const n = await StaffService.closeStaleEntries(true);
    expect(n).toBeGreaterThanOrEqual(1);
    const r = await pool.query(`SELECT status FROM queue_entries WHERE public_id = 'stale-entry-0001-x'`);
    expect(r.rows[0].status).toBe('CANCELLED');
  });
});
