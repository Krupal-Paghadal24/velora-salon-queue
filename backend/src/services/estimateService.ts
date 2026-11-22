import { query } from '../db/pool.js';
import { BarberWorkState, WaitingCustomer, calculateEstimatedWaitTime } from '../domain/waitEstimator.js';
import { getSalonDateString } from '../utils/date.js';

export interface EstimateContext {
  barbers: BarberWorkState[];
  waiting: Array<WaitingCustomer & { daily_token: number }>;
}

/**
 * Loads the live data the existing wait estimator needs: every barber with their
 * current Called/In-Service customer, plus today's WAITING queue (FCFS).
 */
export async function loadEstimateContext(): Promise<EstimateContext> {
  const today = getSalonDateString();

  const barbersRes = await query<{
    id: string;
    is_on_duty: boolean;
    status: 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
    active_status: string | null;
    active_duration: number | null;
    active_started_at: Date | null;
  }>(
    `SELECT b.id, b.is_on_duty, b.status,
            a.status AS active_status,
            a.total_duration_minutes AS active_duration,
            a.started_at AS active_started_at
     FROM barbers b
     LEFT JOIN queue_entries a
       ON a.assigned_barber_id = b.id AND a.status IN ('CALLED', 'IN_SERVICE')`
  );

  const now = new Date();
  const barbers: BarberWorkState[] = barbersRes.rows.map((b) => ({
    barberId: b.id,
    isOnDuty: b.is_on_duty,
    status: b.status,
    activeServiceDurationMinutes: b.active_duration ?? undefined,
    // CALLED customers have not started yet: full duration remains.
    activeServiceStartedAt: b.active_status
      ? b.active_status === 'IN_SERVICE'
        ? b.active_started_at
        : now
      : null,
  }));

  const waitingRes = await query<{
    id: string;
    daily_token: number;
    preferred_barber_id: string | null;
    total_duration_minutes: number;
    joined_at: Date;
  }>(
    `SELECT id, daily_token, preferred_barber_id, total_duration_minutes, joined_at
     FROM queue_entries
     WHERE status = 'WAITING' AND salon_date = $1
     ORDER BY joined_at ASC, id ASC`,
    [today]
  );

  return {
    barbers,
    waiting: waitingRes.rows.map((w) => ({
      id: w.id,
      daily_token: w.daily_token,
      preferredBarberId: w.preferred_barber_id,
      totalDurationMinutes: w.total_duration_minutes,
      joinedAt: w.joined_at,
    })),
  };
}

/** Position (compatible customers ahead) and wait estimate for one WAITING entry. */
export function estimateForWaiting(
  ctx: EstimateContext,
  target: { preferred_barber_id: string | null; joined_at: Date }
): { positionAhead: number; estimatedWaitMinutes: number | null } {
  const positionAhead = ctx.waiting.filter(
    (w) =>
      w.joinedAt.getTime() < target.joined_at.getTime() &&
      (!target.preferred_barber_id || !w.preferredBarberId || w.preferredBarberId === target.preferred_barber_id)
  ).length;

  const estimatedWaitMinutes = calculateEstimatedWaitTime({
    targetItem: { preferredBarberId: target.preferred_barber_id, joinedAt: target.joined_at },
    barbers: ctx.barbers,
    waitingQueue: ctx.waiting,
  });

  return { positionAhead, estimatedWaitMinutes };
}
