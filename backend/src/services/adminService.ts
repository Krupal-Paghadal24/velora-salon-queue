import type { AdminSettingsResponse, Service } from '@velora/shared';
import { query } from '../db/pool.js';
import { HttpError } from '../utils/httpErrors.js';
import { StaffService } from './staffService.js';

const hhmm = (t: string) => t.slice(0, 5);
const toSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t);

export class AdminService {
  static async getSettings(): Promise<AdminSettingsResponse> {
    const s = await query<AdminSettingsResponse['settings']>(
      `SELECT salon_name, opening_time, closing_time, online_cutoff_minutes, is_online_joining_enabled
       FROM salon_settings WHERE id = 1`
    );
    const services = await query<Service>(
      `SELECT id, name_en, name_gu, duration_minutes, price_inr::float8 AS price_inr, is_enabled, sort_order
       FROM services ORDER BY sort_order ASC, name_en ASC`
    );
    if (s.rows.length === 0) throw new HttpError(500, 'Salon settings are missing. Run the database seed.');
    return { settings: s.rows[0], services: services.rows, barbers: await StaffService.listBarbers() };
  }

  static async updateSettings(patch: {
    is_online_joining_enabled?: boolean;
    opening_time?: string;
    closing_time?: string;
    online_cutoff_minutes?: number;
  }): Promise<AdminSettingsResponse> {
    const cur = (await this.getSettings()).settings;
    const next = {
      is_online_joining_enabled: patch.is_online_joining_enabled ?? cur.is_online_joining_enabled,
      opening_time: toSeconds(patch.opening_time ?? cur.opening_time),
      closing_time: toSeconds(patch.closing_time ?? cur.closing_time),
      online_cutoff_minutes: patch.online_cutoff_minutes ?? cur.online_cutoff_minutes,
    };
    if (hhmm(next.opening_time) >= hhmm(next.closing_time)) {
      throw new HttpError(400, 'Opening time must be earlier than closing time.');
    }
    await query(
      `UPDATE salon_settings
       SET is_online_joining_enabled = $1, opening_time = $2, closing_time = $3,
           online_cutoff_minutes = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [next.is_online_joining_enabled, next.opening_time, next.closing_time, next.online_cutoff_minutes]
    );
    return this.getSettings();
  }

  static async setServiceEnabled(serviceId: string, enabled: boolean): Promise<void> {
    const r = await query('UPDATE services SET is_enabled = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
      serviceId,
      enabled,
    ]);
    if (r.rowCount === 0) throw new HttpError(404, 'Service not found');
  }
}
