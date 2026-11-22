import type pg from 'pg';
import {
  StaffBoardResponse,
  StaffBarber,
  StaffQueueEntry,
  StaffRole,
  QueueStatusEnum,
} from '@velora/shared';
import { getClient, query } from '../db/pool.js';
import { QueueEngine, QueueEntryRow } from '../domain/queueEngine.js';
import { getSalonDateString } from '../utils/date.js';
import { HttpError } from '../utils/httpErrors.js';
import { loadEstimateContext, estimateForWaiting } from './estimateService.js';

export interface Actor {
  id: string;
  role: StaffRole;
  barberId: string | null;
}

async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

let staleClosedForDate: string | null = null;

export class StaffService {
  /**
   * Housekeeping: entries left open from a previous salon day are closed so they cannot
   * block today's phone-duplicate check or leave barbers marked busy. Runs at most once per
   * salon date (cheap no-op afterwards). Waiting -> Cancelled, Called -> No-show, In Service -> Done.
   */
  static async closeStaleEntries(force = false): Promise<number> {
    const today = getSalonDateString();
    if (!force && staleClosedForDate === today) return 0;

    const closed = await withTransaction(async (c) => {
      const w = await c.query(
        `WITH u AS (
           UPDATE queue_entries SET status='CANCELLED', cancelled_at=CURRENT_TIMESTAMP, cancelled_by='STAFF',
             cancellation_reason='Auto-closed: not served before end of day', updated_at=CURRENT_TIMESTAMP
           WHERE status='WAITING' AND salon_date < $1 RETURNING id)
         INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
         SELECT id, 'WAITING', 'CANCELLED', 'OWNER', 'Auto-closed at day rollover' FROM u`,
        [today]
      );
      const n = await c.query(
        `WITH u AS (
           UPDATE queue_entries SET status='NO_SHOW', cancelled_by='STAFF',
             cancellation_reason='Auto-closed: not served before end of day', updated_at=CURRENT_TIMESTAMP
           WHERE status='CALLED' AND salon_date < $1 RETURNING id)
         INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
         SELECT id, 'CALLED', 'NO_SHOW', 'OWNER', 'Auto-closed at day rollover' FROM u`,
        [today]
      );
      const d = await c.query(
        `WITH u AS (
           UPDATE queue_entries SET status='DONE', finished_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
           WHERE status='IN_SERVICE' AND salon_date < $1 RETURNING id)
         INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
         SELECT id, 'IN_SERVICE', 'DONE', 'OWNER', 'Auto-closed at day rollover' FROM u`,
        [today]
      );
      await c.query(
        `UPDATE barbers SET status='AVAILABLE', updated_at=CURRENT_TIMESTAMP
         WHERE status='BUSY' AND NOT EXISTS (
           SELECT 1 FROM queue_entries e WHERE e.assigned_barber_id = barbers.id AND e.status IN ('CALLED','IN_SERVICE'))`
      );
      return (w.rowCount ?? 0) + (n.rowCount ?? 0) + (d.rowCount ?? 0);
    });

    staleClosedForDate = today;
    return closed;
  }

  static async listBarbers(): Promise<StaffBarber[]> {
    const res = await query<StaffBarber>(
      `SELECT b.id, b.name, b.speciality, b.is_on_duty, b.status, a.id AS active_entry_id
       FROM barbers b
       LEFT JOIN queue_entries a ON a.assigned_barber_id = b.id AND a.status IN ('CALLED','IN_SERVICE')
       ORDER BY b.name ASC`
    );
    return res.rows;
  }

  /** Reception board: today's entries, all barbers, live stats. */
  static async getBoard(): Promise<StaffBoardResponse> {
    await this.closeStaleEntries();
    const today = getSalonDateString();

    const entriesRes = await query<
      QueueEntryRow & { preferred_barber_name: string | null }
    >(
      `SELECT e.*, pb.name AS preferred_barber_name
       FROM queue_entries e
       LEFT JOIN barbers pb ON pb.id = e.preferred_barber_id
       WHERE e.salon_date = $1
       ORDER BY e.joined_at ASC, e.id ASC`,
      [today]
    );

    const ids = entriesRes.rows.map((e) => e.id);
    const servicesByEntry = new Map<string, StaffQueueEntry['services']>();
    if (ids.length > 0) {
      const svcRes = await query<{
        queue_entry_id: string;
        service_name_en: string;
        service_name_gu: string;
        duration_minutes: number;
      }>(
        `SELECT queue_entry_id, service_name_en, service_name_gu, duration_minutes
         FROM queue_entry_services WHERE queue_entry_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
        [ids]
      );
      for (const s of svcRes.rows) {
        const list = servicesByEntry.get(s.queue_entry_id) ?? [];
        list.push({ name_en: s.service_name_en, name_gu: s.service_name_gu, duration_minutes: s.duration_minutes });
        servicesByEntry.set(s.queue_entry_id, list);
      }
    }

    const ctx = await loadEstimateContext();
    const entries: StaffQueueEntry[] = entriesRes.rows.map((e) => {
      let position_ahead: number | null = null;
      let estimated_wait_minutes: number | null = null;
      if (e.status === QueueStatusEnum.WAITING) {
        const est = estimateForWaiting(ctx, e);
        position_ahead = est.positionAhead;
        estimated_wait_minutes = est.estimatedWaitMinutes;
      }
      return {
        id: e.id,
        daily_token: e.daily_token,
        status: e.status,
        customer_name: e.customer_name,
        customer_phone: e.customer_phone,
        preferred_barber_id: e.preferred_barber_id,
        preferred_barber_name: e.preferred_barber_name,
        assigned_barber_id: e.assigned_barber_id,
        total_duration_minutes: e.total_duration_minutes,
        total_price_inr: Number(e.total_price_inr),
        is_walk_in: e.is_walk_in,
        services: servicesByEntry.get(e.id) ?? [],
        joined_at: e.joined_at.toISOString(),
        called_at: e.called_at ? e.called_at.toISOString() : null,
        started_at: e.started_at ? e.started_at.toISOString() : null,
        position_ahead,
        estimated_wait_minutes,
      };
    });

    const count = (s: string) => entries.filter((e) => e.status === s).length;
    const waits = entriesRes.rows
      .filter((e) => e.started_at)
      .map((e) => (e.started_at!.getTime() - e.joined_at.getTime()) / 60000);

    return {
      salon_date: today,
      server_time: new Date().toISOString(),
      stats: {
        waiting: count('WAITING'),
        called: count('CALLED'),
        in_service: count('IN_SERVICE'),
        done: count('DONE'),
        cancelled: count('CANCELLED'),
        no_show: count('NO_SHOW'),
        avg_wait_minutes: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
      },
      barbers: await this.listBarbers(),
      entries,
    };
  }

  /** Barber phone view: own barber record, current customer, next compatible waiting customer. */
  static async getBarberView(barberId: string) {
    await this.closeStaleEntries();
    const today = getSalonDateString();
    const barbers = await this.listBarbers();
    const barber = barbers.find((b) => b.id === barberId);
    if (!barber) throw new HttpError(404, 'Barber not found');

    const activeRes = await query<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE assigned_barber_id = $1 AND status IN ('CALLED','IN_SERVICE') LIMIT 1`,
      [barberId]
    );
    const nextRes = await query<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE status = 'WAITING' AND salon_date = $2
         AND (preferred_barber_id = $1 OR preferred_barber_id IS NULL)
       ORDER BY joined_at ASC, id ASC`,
      [barberId, today]
    );

    const svcFor = async (id: string) =>
      (
        await query<{ service_name_en: string; service_name_gu: string; duration_minutes: number }>(
          'SELECT service_name_en, service_name_gu, duration_minutes FROM queue_entry_services WHERE queue_entry_id = $1 ORDER BY created_at ASC',
          [id]
        )
      ).rows.map((s) => ({ name_en: s.service_name_en, name_gu: s.service_name_gu, duration_minutes: s.duration_minutes }));

    const a = activeRes.rows[0];
    const n = nextRes.rows[0];
    return {
      barber,
      server_time: new Date().toISOString(),
      active: a
        ? {
            id: a.id,
            daily_token: a.daily_token,
            status: a.status,
            customer_name: a.customer_name,
            total_duration_minutes: a.total_duration_minutes,
            called_at: a.called_at ? a.called_at.toISOString() : null,
            started_at: a.started_at ? a.started_at.toISOString() : null,
            services: await svcFor(a.id),
          }
        : null,
      next: n
        ? {
            daily_token: n.daily_token,
            total_duration_minutes: n.total_duration_minutes,
            joined_at: n.joined_at.toISOString(),
            requested_me: n.preferred_barber_id === barberId,
            services: await svcFor(n.id),
          }
        : null,
      compatible_waiting_count: nextRes.rows.length,
    };
  }

  private static assertBarberScope(actor: Actor, barberId: string | null): void {
    if (actor.role === 'BARBER' && (!actor.barberId || actor.barberId !== barberId)) {
      throw new HttpError(403, 'You can only manage your own station.');
    }
  }

  static async callNext(barberId: string, actor: Actor): Promise<QueueEntryRow | null> {
    this.assertBarberScope(actor, barberId);
    return withTransaction((c) => QueueEngine.callNext(c, barberId, actor.id));
  }

  private static async assignedBarberOf(entryId: string): Promise<string | null> {
    const r = await query<{ assigned_barber_id: string | null }>(
      'SELECT assigned_barber_id FROM queue_entries WHERE id = $1',
      [entryId]
    );
    if (r.rows.length === 0) throw new HttpError(404, 'Queue entry not found');
    return r.rows[0].assigned_barber_id;
  }

  static async startService(entryId: string, actor: Actor): Promise<QueueEntryRow> {
    const assigned = await this.assignedBarberOf(entryId);
    this.assertBarberScope(actor, assigned);
    if (!assigned) throw new HttpError(409, 'This customer has not been called yet');
    return withTransaction((c) => QueueEngine.startService(c, entryId, assigned));
  }

  static async finishService(entryId: string, actor: Actor): Promise<QueueEntryRow> {
    const assigned = await this.assignedBarberOf(entryId);
    this.assertBarberScope(actor, assigned);
    if (!assigned) throw new HttpError(409, 'This customer is not in service');
    return withTransaction((c) => QueueEngine.finishService(c, entryId, assigned));
  }

  static async markNoShow(entryId: string, actor: Actor, reason?: string): Promise<QueueEntryRow> {
    const assigned = await this.assignedBarberOf(entryId);
    this.assertBarberScope(actor, assigned);
    return withTransaction((c) => QueueEngine.markNoShow(c, entryId, actor.id, reason));
  }

  /** Staff cancel: allowed only while WAITING (Called customers are handled via No-show). */
  static async cancelEntry(entryId: string, reason?: string): Promise<QueueEntryRow> {
    return withTransaction(async (c) => {
      const cur = await c.query<{ status: string }>('SELECT status FROM queue_entries WHERE id = $1', [entryId]);
      if (cur.rows.length === 0) throw new HttpError(404, 'Queue entry not found');
      if (cur.rows[0].status === 'CALLED') {
        throw new HttpError(409, 'This customer has been called. Use "Mark No-Show" instead.');
      }
      return QueueEngine.cancelEntry(c, entryId, 'STAFF', reason || 'Cancelled by reception');
    });
  }

  /** Barber break / duty toggles. Never allowed while the barber has a Called or In-Service customer. */
  static async setAvailability(
    barberId: string,
    patch: { status?: 'AVAILABLE' | 'ON_BREAK'; is_on_duty?: boolean },
    actor: Actor
  ): Promise<StaffBarber> {
    this.assertBarberScope(actor, barberId);
    if (patch.is_on_duty !== undefined && actor.role === 'BARBER') {
      throw new HttpError(403, 'Only reception or the owner can change duty status.');
    }
    await withTransaction(async (c) => {
      const b = await c.query<{ id: string; status: string; is_on_duty: boolean }>(
        'SELECT id, status, is_on_duty FROM barbers WHERE id = $1 FOR UPDATE',
        [barberId]
      );
      if (b.rows.length === 0) throw new HttpError(404, 'Barber not found');
      const active = await c.query(
        `SELECT 1 FROM queue_entries WHERE assigned_barber_id = $1 AND status IN ('CALLED','IN_SERVICE') LIMIT 1`,
        [barberId]
      );
      if (active.rows.length > 0) {
        throw new HttpError(409, 'Finish or release the current customer before changing availability.');
      }
      const status = patch.status ?? (b.rows[0].status === 'BUSY' ? 'AVAILABLE' : b.rows[0].status);
      const onDuty = patch.is_on_duty ?? b.rows[0].is_on_duty;
      await c.query('UPDATE barbers SET status = $2, is_on_duty = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
        barberId,
        status,
        onDuty,
      ]);
    });
    const updated = (await this.listBarbers()).find((x) => x.id === barberId);
    return updated!;
  }
}
