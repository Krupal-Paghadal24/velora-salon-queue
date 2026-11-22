import type { DisplayResponse } from '@velora/shared';
import { query } from '../db/pool.js';
import { getSalonDateString } from '../utils/date.js';
import { loadEstimateContext, estimateForWaiting } from './estimateService.js';
import { StaffService } from './staffService.js';

/**
 * Public TV payload. Contains token numbers and barber names ONLY:
 * no customer names, phones, tracking ids or internal queue-entry ids.
 */
export class DisplayService {
  static async getDisplay(): Promise<DisplayResponse> {
    await StaffService.closeStaleEntries();
    const today = getSalonDateString();

    const [settings, barbers, waiting] = await Promise.all([
      query<{ salon_name: string }>('SELECT salon_name FROM salon_settings WHERE id = 1'),
      query<{ name: string; status: string; active_status: string | null; active_token: number | null }>(
        `SELECT b.name, b.status, a.status AS active_status, a.daily_token AS active_token
         FROM barbers b
         LEFT JOIN queue_entries a ON a.assigned_barber_id = b.id AND a.status IN ('CALLED','IN_SERVICE')
         WHERE b.is_on_duty = true
         ORDER BY b.name ASC`
      ),
      query<{
        id: string;
        daily_token: number;
        preferred_barber_id: string | null;
        preferred_barber_name: string | null;
        joined_at: Date;
      }>(
        `SELECT e.id, e.daily_token, e.preferred_barber_id, pb.name AS preferred_barber_name, e.joined_at
         FROM queue_entries e LEFT JOIN barbers pb ON pb.id = e.preferred_barber_id
         WHERE e.status = 'WAITING' AND e.salon_date = $1
         ORDER BY e.joined_at ASC, e.id ASC`,
        [today]
      ),
    ]);

    const ctx = await loadEstimateContext();

    return {
      salon_name: settings.rows[0]?.salon_name || 'Velora Salon',
      server_time: new Date().toISOString(),
      stations: barbers.rows.map((b) => ({
        barber_name: b.name,
        state:
          b.active_status === 'CALLED'
            ? 'CALLED'
            : b.active_status === 'IN_SERVICE'
            ? 'SERVING'
            : b.status === 'ON_BREAK'
            ? 'ON_BREAK'
            : 'AVAILABLE',
        token: b.active_token,
      })),
      next: waiting.rows.slice(0, 5).map((w) => ({
        token: w.daily_token,
        preferred_barber_name: w.preferred_barber_name,
        estimated_wait_minutes: estimateForWaiting(ctx, w).estimatedWaitMinutes,
      })),
      waiting_count: waiting.rows.length,
    };
  }
}
