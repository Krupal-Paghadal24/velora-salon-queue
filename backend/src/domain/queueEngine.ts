import type pg from 'pg';
import {
  QueueStatus,
  QueueStatusEnum,
  isValidStatusTransition,
  normalizeIndianPhone,
} from '@velora/shared';
import { generatePublicId, getSalonDateString } from '../utils/date.js';
import { getNextDailyToken } from './tokenService.js';

export interface DbServiceRecord {
  id: string;
  name_en: string;
  name_gu: string;
  duration_minutes: number;
  price_inr: string | number;
  is_enabled: boolean;
}

export interface DbBarberRecord {
  id: string;
  name: string;
  is_on_duty: boolean;
  status: 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
}

export interface QueueEntryRow {
  id: string;
  public_id: string;
  daily_token: number;
  salon_date: string;
  customer_name: string;
  customer_phone: string;
  preferred_barber_id: string | null;
  assigned_barber_id: string | null;
  status: QueueStatus;
  total_duration_minutes: number;
  total_price_inr: string | number;
  is_walk_in: boolean;
  joined_at: Date;
  called_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  cancelled_at: Date | null;
}

export function canMarkNoShow(calledAt: Date, now: Date = new Date(), requiredMinutes = 10): boolean {
  return now.getTime() - calledAt.getTime() >= requiredMinutes * 60 * 1000;
}

/**
 * Pure helper to pick the next compatible waiting entry for a barber.
 * Respects strict FCFS ordering based on joined_at and tie-breaker id.
 */
export function selectNextCompatibleEntry<T extends { preferred_barber_id: string | null; joined_at: Date }>(
  barberId: string,
  waitingEntries: T[]
): T | null {
  const compatible = waitingEntries.filter(
    (entry) => entry.preferred_barber_id === barberId || entry.preferred_barber_id === null
  );

  if (compatible.length === 0) return null;

  // Stable sort by joined_at ascending
  return compatible.sort((a, b) => a.joined_at.getTime() - b.joined_at.getTime())[0];
}

/**
 * Queue Engine provides atomic domain operations with PostgreSQL transactional consistency.
 */
export class QueueEngine {
  /**
   * Customer or Walk-in joins the queue.
   * Prevents duplicate active entries for the same normalized phone number.
   */
  static async joinQueue(
    client: pg.PoolClient,
    input: {
      customer_name: string;
      customer_phone: string;
      service_ids: string[];
      preferred_barber_id?: string | null;
      is_walk_in?: boolean;
    }
  ): Promise<{ entry: QueueEntryRow; isExisting: boolean }> {
    const normalizedPhone = normalizeIndianPhone(input.customer_phone);

    // 1. Check for active entry with row lock
    const activeCheck = await client.query<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE customer_phone = $1 AND status IN ('WAITING', 'CALLED', 'IN_SERVICE')
       LIMIT 1`,
      [normalizedPhone]
    );

    if (activeCheck.rows.length > 0) {
      // Duplicate active found -> return existing entry (do not create new token)
      return { entry: activeCheck.rows[0], isExisting: true };
    }

    // 2. Fetch and validate selected services
    const servicesRes = await client.query<DbServiceRecord>(
      `SELECT * FROM services WHERE id = ANY($1::uuid[]) AND is_enabled = true`,
      [input.service_ids]
    );

    if (servicesRes.rows.length === 0) {
      throw new Error('No valid enabled services selected');
    }

    if (servicesRes.rows.length !== input.service_ids.length) {
      throw new Error('One or more selected services are disabled or invalid');
    }

    const totalDuration = servicesRes.rows.reduce((sum, s) => sum + s.duration_minutes, 0);
    const totalPrice = servicesRes.rows.reduce((sum, s) => sum + Number(s.price_inr), 0);

    // 3. Validate preferred barber if specified
    if (input.preferred_barber_id) {
      const barberCheck = await client.query<DbBarberRecord>(
        `SELECT id, is_on_duty, status FROM barbers WHERE id = $1`,
        [input.preferred_barber_id]
      );
      if (
        barberCheck.rows.length === 0 ||
        !barberCheck.rows[0].is_on_duty ||
        barberCheck.rows[0].status !== 'AVAILABLE'
      ) {
        throw new Error('Selected barber is not on duty or unavailable');
      }
    } else {
      const eligible = await client.query(
        `SELECT 1 FROM barbers WHERE is_on_duty = true AND status = 'AVAILABLE' LIMIT 1`
      );
      if (eligible.rows.length === 0) {
        throw new Error('No eligible barber is available to accept a customer');
      }
    }

    // 4. Generate token and public tracking ID
    const { salonDate, tokenNumber } = await getNextDailyToken(client);
    const publicId = generatePublicId();

    // 5. Insert queue entry
    const insertEntryRes = await client.query<QueueEntryRow>(
      `INSERT INTO queue_entries (
        public_id, daily_token, salon_date, customer_name, customer_phone,
        preferred_barber_id, status, total_duration_minutes, total_price_inr,
        is_walk_in, joined_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'WAITING', $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        publicId,
        tokenNumber,
        salonDate,
        input.customer_name.trim(),
        normalizedPhone,
        input.preferred_barber_id || null,
        totalDuration,
        totalPrice,
        Boolean(input.is_walk_in),
      ]
    );

    const newEntry = insertEntryRes.rows[0];

    // 6. Snapshot selected services in junction table
    for (const service of servicesRes.rows) {
      await client.query(
        `INSERT INTO queue_entry_services (
          queue_entry_id, service_id, service_name_en, service_name_gu, duration_minutes, price_inr
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newEntry.id,
          service.id,
          service.name_en,
          service.name_gu,
          service.duration_minutes,
          service.price_inr,
        ]
      );
    }

    // 7. Initial audit log
    await client.query(
      `INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
       VALUES ($1, NULL, 'WAITING', $2, 'Customer joined queue')`,
      [newEntry.id, input.is_walk_in ? 'RECEPTIONIST' : 'CUSTOMER']
    );

    return { entry: newEntry, isExisting: false };
  }

  /**
   * Receptionist calls the next compatible customer for a barber.
   * Uses serialized row locks to ensure no race conditions between receptionists.
   */
  static async callNext(
    client: pg.PoolClient,
    barberId: string,
    calledByStaffId: string
  ): Promise<QueueEntryRow | null> {
    // 1. Verify barber is available and has no active customer
    const barberRes = await client.query<DbBarberRecord>(
      `SELECT * FROM barbers WHERE id = $1 FOR UPDATE`,
      [barberId]
    );

    if (barberRes.rows.length === 0) {
      throw new Error('Barber not found');
    }

    const barber = barberRes.rows[0];
    if (!barber.is_on_duty) {
      throw new Error('Barber is off duty');
    }

    if (barber.status === 'ON_BREAK') {
      throw new Error('Barber is currently on break');
    }

    // Check if barber already has an active customer (CALLED or IN_SERVICE)
    const activeCustomer = await client.query(
      `SELECT id FROM queue_entries
       WHERE assigned_barber_id = $1 AND status IN ('CALLED', 'IN_SERVICE')
       LIMIT 1`,
      [barberId]
    );

    if (activeCustomer.rows.length > 0) {
      throw new Error('Barber already has an active customer in service or called');
    }

    // 2. Lock and select earliest compatible WAITING customer
    const candidateRes = await client.query<QueueEntryRow>(
      `SELECT * FROM queue_entries
       WHERE status = 'WAITING'
         AND salon_date = $2
         AND (preferred_barber_id = $1 OR preferred_barber_id IS NULL)
       ORDER BY joined_at ASC, id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [barberId, getSalonDateString()]
    );

    if (candidateRes.rows.length === 0) {
      return null; // No waiting compatible customer
    }

    const candidate = candidateRes.rows[0];

    // 3. Transition: WAITING -> CALLED
    if (!isValidStatusTransition(candidate.status, QueueStatusEnum.CALLED)) {
      throw new Error(`Invalid status transition from ${candidate.status} to CALLED`);
    }

    const updateRes = await client.query<QueueEntryRow>(
      `UPDATE queue_entries
       SET status = 'CALLED',
           assigned_barber_id = $1,
           called_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [barberId, candidate.id]
    );

    // 4. Update barber status to BUSY
    await client.query(`UPDATE barbers SET status = 'BUSY', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      barberId,
    ]);

    // 5. Audit log
    await client.query(
      `INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
       VALUES ($1, 'WAITING', 'CALLED', 'RECEPTIONIST', $2)`,
      [candidate.id, `Called by staff ${calledByStaffId} for barber ${barber.name}`]
    );

    return updateRes.rows[0];
  }

  /**
   * Barber starts service (CALLED -> IN_SERVICE).
   */
  static async startService(
    client: pg.PoolClient,
    queueEntryId: string,
    barberId: string
  ): Promise<QueueEntryRow> {
    const entryRes = await client.query<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE id = $1 FOR UPDATE`,
      [queueEntryId]
    );

    if (entryRes.rows.length === 0) {
      throw new Error('Queue entry not found');
    }

    const entry = entryRes.rows[0];

    if (entry.assigned_barber_id !== barberId) {
      throw new Error('This customer is assigned to a different barber');
    }

    if (!isValidStatusTransition(entry.status, QueueStatusEnum.IN_SERVICE)) {
      throw new Error(`Invalid transition from ${entry.status} to IN_SERVICE`);
    }

    const updated = await client.query<QueueEntryRow>(
      `UPDATE queue_entries
       SET status = 'IN_SERVICE',
           started_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [queueEntryId]
    );

    await client.query(
      `INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
       VALUES ($1, 'CALLED', 'IN_SERVICE', 'BARBER', 'Service started')`,
      [queueEntryId]
    );

    return updated.rows[0];
  }

  /**
   * Barber finishes service (IN_SERVICE -> DONE).
   */
  static async finishService(
    client: pg.PoolClient,
    queueEntryId: string,
    barberId: string
  ): Promise<QueueEntryRow> {
    const entryRes = await client.query<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE id = $1 FOR UPDATE`,
      [queueEntryId]
    );

    if (entryRes.rows.length === 0) {
      throw new Error('Queue entry not found');
    }

    const entry = entryRes.rows[0];

    if (entry.assigned_barber_id !== barberId) {
      throw new Error('This customer is assigned to a different barber');
    }

    if (!isValidStatusTransition(entry.status, QueueStatusEnum.DONE)) {
      throw new Error(`Invalid transition from ${entry.status} to DONE`);
    }

    const updated = await client.query<QueueEntryRow>(
      `UPDATE queue_entries
       SET status = 'DONE',
           finished_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [queueEntryId]
    );

    // Free barber to AVAILABLE
    await client.query(
      `UPDATE barbers SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [barberId]
    );

    await client.query(
      `INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
       VALUES ($1, 'IN_SERVICE', 'DONE', 'BARBER', 'Service completed')`,
      [queueEntryId]
    );

    return updated.rows[0];
  }

  /**
   * Cancel entry (WAITING -> CANCELLED).
   */
  static async cancelEntry(
    client: pg.PoolClient,
    queueEntryId: string,
    cancelledBy: 'CUSTOMER' | 'STAFF',
    reason?: string
  ): Promise<QueueEntryRow> {
    const entryRes = await client.query<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE id = $1 FOR UPDATE`,
      [queueEntryId]
    );

    if (entryRes.rows.length === 0) {
      throw new Error('Queue entry not found');
    }

    const entry = entryRes.rows[0];

    // Customer can only cancel while WAITING
    if (cancelledBy === 'CUSTOMER' && entry.status !== QueueStatusEnum.WAITING) {
      throw new Error('Customers can only cancel while their status is Waiting');
    }

    if (!isValidStatusTransition(entry.status, QueueStatusEnum.CANCELLED)) {
      throw new Error(`Cannot cancel entry with status ${entry.status}`);
    }

    const updated = await client.query<QueueEntryRow>(
      `UPDATE queue_entries
       SET status = 'CANCELLED',
           cancelled_at = CURRENT_TIMESTAMP,
           cancelled_by = $2,
           cancellation_reason = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [queueEntryId, cancelledBy, reason || 'Customer requested cancellation']
    );

    // If barber was assigned, free them
    if (entry.assigned_barber_id) {
      await client.query(
        `UPDATE barbers SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [entry.assigned_barber_id]
      );
    }

    await client.query(
      `INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
       VALUES ($1, $2, 'CANCELLED', $3, $4)`,
      [queueEntryId, entry.status, cancelledBy, reason || 'Cancelled']
    );

    return updated.rows[0];
  }

  /**
   * Mark customer as No-show (CALLED -> NO_SHOW).
   */
  static async markNoShow(
    client: pg.PoolClient,
    queueEntryId: string,
    staffUserId: string,
    reason?: string
  ): Promise<QueueEntryRow> {
    const entryRes = await client.query<QueueEntryRow>(
      `SELECT * FROM queue_entries WHERE id = $1 FOR UPDATE`,
      [queueEntryId]
    );

    if (entryRes.rows.length === 0) {
      throw new Error('Queue entry not found');
    }

    const entry = entryRes.rows[0];

    if (!entry.called_at) {
      throw new Error('Customer was not called');
    }
    if (!canMarkNoShow(entry.called_at)) {
      throw new Error('A customer can only be marked as no-show after 10 minutes');
    }

    if (!isValidStatusTransition(entry.status, QueueStatusEnum.NO_SHOW)) {
      throw new Error(`Cannot mark customer with status ${entry.status} as No-Show`);
    }

    const updated = await client.query<QueueEntryRow>(
      `UPDATE queue_entries
       SET status = 'NO_SHOW',
           cancellation_reason = $2,
           cancelled_by = 'STAFF',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [queueEntryId, reason || 'Customer did not show up within 10 minutes of call']
    );

    // Free barber
    if (entry.assigned_barber_id) {
      await client.query(
        `UPDATE barbers SET status = 'AVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [entry.assigned_barber_id]
      );
    }

    await client.query(
      `INSERT INTO queue_status_logs (queue_entry_id, from_status, to_status, changed_by_role, notes)
       VALUES ($1, 'CALLED', 'NO_SHOW', 'RECEPTIONIST', $2)`,
      [queueEntryId, `Marked no-show by staff ${staffUserId}`]
    );

    return updated.rows[0];
  }
}
