import { getClient, runtimePool, query } from '../db/pool.js';
import { QueueEngine, QueueEntryRow } from '../domain/queueEngine.js';
import { InMemoryTokenGenerator } from '../domain/tokenService.js';
import { generatePublicId, getSalonDateString } from '../utils/date.js';
import { loadEstimateContext, estimateForWaiting } from './estimateService.js';
import {
  JoinQueueInput,
  JoinQueueResponse,
  CustomerQueueStatusResponse,
  normalizeIndianPhone,
  QueueStatusEnum,
  QueueStatus,
} from '@velora/shared';
import { SalonService } from './salonService.js';

// In-Memory store for local development when PostgreSQL is not yet configured
export interface InMemoryQueueItem {
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
  total_price_inr: number;
  is_walk_in: boolean;
  services: Array<{
    name_en: string;
    name_gu: string;
    duration_minutes: number;
    price_inr: number;
  }>;
  joined_at: Date;
  called_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  cancelled_at: Date | null;
}

export const memoryQueue: InMemoryQueueItem[] = [];
export const memoryTokenGen = new InMemoryTokenGenerator();

export class QueueService {
  /**
   * Customer or Walk-in joins queue.
   * If customer phone already has an active entry, returns existing entry.
   */
  static async joinQueue(input: JoinQueueInput): Promise<JoinQueueResponse> {
    const normalizedPhone = normalizeIndianPhone(input.customer_phone);

    // 1. PostgreSQL path
    if (runtimePool) {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const result = await QueueEngine.joinQueue(client, {
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          service_ids: input.service_ids,
          preferred_barber_id: input.preferred_barber_id,
          is_walk_in: input.is_walk_in,
        });
        await client.query('COMMIT');

        const e = result.entry;
        return {
          success: true,
          isExisting: result.isExisting,
          entry: {
            id: e.id,
            public_id: e.public_id,
            daily_token: e.daily_token,
            salon_date: e.salon_date,
            customer_name: e.customer_name,
            customer_phone: e.customer_phone,
            preferred_barber_id: e.preferred_barber_id,
            status: e.status,
            total_duration_minutes: e.total_duration_minutes,
            total_price_inr: Number(e.total_price_inr),
            is_walk_in: e.is_walk_in,
            joined_at: e.joined_at.toISOString(),
          },
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // 2. In-Memory fallback path
    // Duplicate check
    const existing = memoryQueue.find(
      (item) =>
        item.customer_phone === normalizedPhone &&
        ['WAITING', 'CALLED', 'IN_SERVICE'].includes(item.status)
    );

    if (existing) {
      return {
        success: true,
        isExisting: true,
        entry: {
          id: existing.id,
          public_id: existing.public_id,
          daily_token: existing.daily_token,
          salon_date: existing.salon_date,
          customer_name: existing.customer_name,
          customer_phone: existing.customer_phone,
          preferred_barber_id: existing.preferred_barber_id,
          status: existing.status,
          total_duration_minutes: existing.total_duration_minutes,
          total_price_inr: existing.total_price_inr,
          is_walk_in: existing.is_walk_in,
          joined_at: existing.joined_at.toISOString(),
        },
      };
    }

    // Validate services
    const services = await SalonService.getServices();
    const selected = services.filter((s) => input.service_ids.includes(s.id));
    if (selected.length === 0) {
      throw new Error('No valid enabled services selected');
    }
    if (selected.length !== input.service_ids.length) {
      throw new Error('One or more selected services are disabled or invalid');
    }

    const barbers = await SalonService.getBarbers();
    if (input.preferred_barber_id) {
      const selectedBarber = barbers.find((b) => b.id === input.preferred_barber_id);
      if (
        !selectedBarber ||
        !selectedBarber.is_on_duty ||
        selectedBarber.status !== 'AVAILABLE'
      ) {
        throw new Error('Selected barber is not on duty or unavailable');
      }
    } else if (!barbers.some((b) => b.is_on_duty && b.status === 'AVAILABLE')) {
      throw new Error('No eligible barber is available to accept a customer');
    }

    const totalDuration = selected.reduce((sum, s) => sum + s.duration_minutes, 0);
    const totalPrice = selected.reduce((sum, s) => sum + Number(s.price_inr), 0);

    const { salonDate, tokenNumber } = memoryTokenGen.getNextDailyToken();
    const publicId = generatePublicId();

    const newEntry: InMemoryQueueItem = {
      id: crypto.randomUUID(),
      public_id: publicId,
      daily_token: tokenNumber,
      salon_date: salonDate,
      customer_name: input.customer_name.trim(),
      customer_phone: normalizedPhone,
      preferred_barber_id: input.preferred_barber_id || null,
      assigned_barber_id: null,
      status: QueueStatusEnum.WAITING,
      total_duration_minutes: totalDuration,
      total_price_inr: totalPrice,
      is_walk_in: Boolean(input.is_walk_in),
      services: selected.map((s) => ({
        name_en: s.name_en,
        name_gu: s.name_gu,
        duration_minutes: s.duration_minutes,
        price_inr: Number(s.price_inr),
      })),
      joined_at: new Date(),
      called_at: null,
      started_at: null,
      finished_at: null,
      cancelled_at: null,
    };

    memoryQueue.push(newEntry);

    return {
      success: true,
      isExisting: false,
      entry: {
        id: newEntry.id,
        public_id: newEntry.public_id,
        daily_token: newEntry.daily_token,
        salon_date: newEntry.salon_date,
        customer_name: newEntry.customer_name,
        customer_phone: newEntry.customer_phone,
        preferred_barber_id: newEntry.preferred_barber_id,
        status: newEntry.status,
        total_duration_minutes: newEntry.total_duration_minutes,
        total_price_inr: newEntry.total_price_inr,
        is_walk_in: newEntry.is_walk_in,
        joined_at: newEntry.joined_at.toISOString(),
      },
    };
  }

  /**
   * Retrieve rich entry for private customer tracking at /status/:publicId
   */
  static async getQueueEntryByPublicId(publicId: string): Promise<CustomerQueueStatusResponse | null> {
    // 1. PostgreSQL path
    if (runtimePool) {
      const res = await query<QueueEntryRow>(
        'SELECT * FROM queue_entries WHERE public_id = $1 LIMIT 1',
        [publicId]
      );
      if (res.rows.length === 0) return null;
      const entry = res.rows[0];

      // Fetch snapshotted services
      const servicesRes = await query<{
        service_name_en: string;
        service_name_gu: string;
        duration_minutes: number;
        price_inr: string | number;
      }>('SELECT * FROM queue_entry_services WHERE queue_entry_id = $1', [entry.id]);

      // Fetch barber names
      let preferredBarberName: string | null = null;
      if (entry.preferred_barber_id) {
        const bRes = await query<{ name: string }>('SELECT name FROM barbers WHERE id = $1', [
          entry.preferred_barber_id,
        ]);
        if (bRes.rows.length > 0) preferredBarberName = bRes.rows[0].name;
      }

      let assignedBarberName: string | null = null;
      if (entry.assigned_barber_id) {
        const aRes = await query<{ name: string }>('SELECT name FROM barbers WHERE id = $1', [
          entry.assigned_barber_id,
        ]);
        if (aRes.rows.length > 0) assignedBarberName = aRes.rows[0].name;
      }

      // Position + wait estimate only while WAITING (live data: active services, FCFS, barber availability)
      let positionAhead: number | null = null;
      let estimatedWaitMinutes: number | null = null;

      if (entry.status === QueueStatusEnum.WAITING) {
        const ctx = await loadEstimateContext();
        const est = estimateForWaiting(ctx, entry);
        positionAhead = est.positionAhead;
        estimatedWaitMinutes = est.estimatedWaitMinutes;
      }

      return {
        public_id: entry.public_id,
        daily_token: entry.daily_token,
        salon_date: entry.salon_date,
        customer_name: entry.customer_name,
        status: entry.status,
        preferred_barber_id: entry.preferred_barber_id,
        preferred_barber_name: preferredBarberName,
        assigned_barber_id: entry.assigned_barber_id,
        assigned_barber_name: assignedBarberName,
        total_duration_minutes: entry.total_duration_minutes,
        total_price_inr: Number(entry.total_price_inr),
        is_walk_in: entry.is_walk_in,
        position_ahead: positionAhead,
        estimated_wait_minutes: estimatedWaitMinutes,
        services: servicesRes.rows.map((s) => ({
          name_en: s.service_name_en,
          name_gu: s.service_name_gu,
          duration_minutes: s.duration_minutes,
          price_inr: Number(s.price_inr),
        })),
        joined_at: entry.joined_at.toISOString(),
        called_at: entry.called_at ? entry.called_at.toISOString() : null,
        started_at: entry.started_at ? entry.started_at.toISOString() : null,
        finished_at: entry.finished_at ? entry.finished_at.toISOString() : null,
        cancelled_at: entry.cancelled_at ? entry.cancelled_at.toISOString() : null,
      };
    }

    // 2. In-Memory fallback path
    const item = memoryQueue.find((i) => i.public_id === publicId);
    if (!item) return null;

    let positionAhead: number | null = null;
    let estimatedWaitMinutes: number | null = null;

    if (item.status === QueueStatusEnum.WAITING) {
      const ahead = memoryQueue.filter((other) => {
        const isWaiting = other.status === QueueStatusEnum.WAITING;
        const isEarlier = other.joined_at.getTime() < item.joined_at.getTime();
        const isCompatible =
          !item.preferred_barber_id ||
          other.preferred_barber_id === item.preferred_barber_id ||
          !other.preferred_barber_id;
        return isWaiting && isEarlier && isCompatible;
      });
      positionAhead = ahead.length;
      estimatedWaitMinutes = (positionAhead + 1) * 15;
    }

    const barbers = await SalonService.getBarbers();
    const preferredBarber = barbers.find((b) => b.id === item.preferred_barber_id);
    const assignedBarber = barbers.find((b) => b.id === item.assigned_barber_id);

    return {
      public_id: item.public_id,
      daily_token: item.daily_token,
      salon_date: item.salon_date,
      customer_name: item.customer_name,
      status: item.status,
      preferred_barber_id: item.preferred_barber_id,
      preferred_barber_name: preferredBarber ? preferredBarber.name : null,
      assigned_barber_id: item.assigned_barber_id,
      assigned_barber_name: assignedBarber ? assignedBarber.name : null,
      total_duration_minutes: item.total_duration_minutes,
      total_price_inr: item.total_price_inr,
      is_walk_in: item.is_walk_in,
      position_ahead: positionAhead,
      estimated_wait_minutes: estimatedWaitMinutes,
      services: item.services,
      joined_at: item.joined_at.toISOString(),
      called_at: item.called_at ? item.called_at.toISOString() : null,
      started_at: item.started_at ? item.started_at.toISOString() : null,
      finished_at: item.finished_at ? item.finished_at.toISOString() : null,
      cancelled_at: item.cancelled_at ? item.cancelled_at.toISOString() : null,
    };
  }

  /**
   * Customer cancels their own queue entry while status is WAITING
   */
  static async cancelQueueEntry(
    publicId: string,
    reason: string = 'Customer cancelled from tracking page'
  ): Promise<{ success: boolean; status: QueueStatus }> {
    // 1. PostgreSQL path
    if (runtimePool) {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const res = await client.query<{ id: string; status: QueueStatus }>(
          'SELECT id, status FROM queue_entries WHERE public_id = $1 FOR UPDATE',
          [publicId]
        );
        if (res.rows.length === 0) {
          throw new Error('Queue entry not found');
        }

        const entry = res.rows[0];
        if (entry.status !== QueueStatusEnum.WAITING) {
          throw new Error('Customers can only cancel while their status is Waiting');
        }

        await QueueEngine.cancelEntry(client, entry.id, 'CUSTOMER', reason);
        await client.query('COMMIT');
        return { success: true, status: QueueStatusEnum.CANCELLED };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // 2. In-Memory fallback path
    const item = memoryQueue.find((i) => i.public_id === publicId);
    if (!item) {
      throw new Error('Queue entry not found');
    }

    if (item.status !== QueueStatusEnum.WAITING) {
      throw new Error('Customers can only cancel while their status is Waiting');
    }

    item.status = QueueStatusEnum.CANCELLED;
    item.cancelled_at = new Date();
    return { success: true, status: QueueStatusEnum.CANCELLED };
  }

  /**
   * Helper to seed/mutate in-memory queue entry status for isolated testing
   */
  static setInMemoryEntryStatus(publicId: string, status: QueueStatus, barberId?: string): void {
    const item = memoryQueue.find((i) => i.public_id === publicId);
    if (item) {
      item.status = status;
      if (barberId) item.assigned_barber_id = barberId;
      if (status === QueueStatusEnum.CALLED) item.called_at = new Date();
      if (status === QueueStatusEnum.IN_SERVICE) item.started_at = new Date();
      if (status === QueueStatusEnum.DONE) item.finished_at = new Date();
      if (status === QueueStatusEnum.CANCELLED) item.cancelled_at = new Date();
      if (status === QueueStatusEnum.NO_SHOW) item.cancelled_at = new Date();
    }
  }
}
