import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, runtimePoolMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  runtimePoolMock: {},
}));

let serviceRows: Array<{
  id: string;
  name_en: string;
  name_gu: string;
  duration_minutes: number;
  price_inr: string | number;
  is_enabled: boolean;
  sort_order: number;
}> = [];

vi.mock('../src/db/pool.js', () => ({
  query: queryMock,
  runtimePool: runtimePoolMock,
}));

import { SalonService } from '../src/services/salonService.js';

describe('Public salon summary wait estimate', () => {
  beforeEach(() => {
    queryMock.mockReset();
    serviceRows = [];
    queryMock.mockImplementation(async (sql: string) => {
      const statement = sql.toLowerCase();
      const now = Date.now();

      if (statement.includes('from salon_settings')) {
        return {
          rows: [
            {
              salon_name: 'Velora Salon',
              timezone: 'Asia/Kolkata',
              opening_time: '00:00:00',
              closing_time: '23:59:59',
              online_cutoff_minutes: 30,
              is_online_joining_enabled: true,
            },
          ],
        };
      }

      if (statement.includes('from services')) return { rows: serviceRows };

      if (statement.includes('count(*)')) return { rows: [{ count: '2' }] };

      if (statement.includes('active_status')) {
        return {
          rows: [
            {
              id: 'barber-busy',
              is_on_duty: true,
              status: 'BUSY',
              active_status: 'IN_SERVICE',
              active_duration: 30,
              active_started_at: new Date(now - 10 * 60_000),
            },
            {
              id: 'barber-available',
              is_on_duty: true,
              status: 'AVAILABLE',
              active_status: null,
              active_duration: null,
              active_started_at: null,
            },
            {
              id: 'barber-break',
              is_on_duty: true,
              status: 'ON_BREAK',
              active_status: null,
              active_duration: null,
              active_started_at: null,
            },
          ],
        };
      }

      if (statement.includes('order by joined_at')) {
        return {
          rows: [
            {
              id: 'waiting-first',
              daily_token: 1,
              preferred_barber_id: null,
              total_duration_minutes: 20,
              joined_at: new Date(now - 20 * 60_000),
            },
            {
              id: 'waiting-second',
              daily_token: 2,
              preferred_barber_id: null,
              total_duration_minutes: 30,
              joined_at: new Date(now - 10 * 60_000),
            },
          ],
        };
      }

      if (statement.includes('where is_on_duty = true')) {
        return {
          rows: [
            { id: 'barber-busy', name: 'Aarav', speciality: null, is_on_duty: true, status: 'BUSY' },
            { id: 'barber-available', name: 'Rohan', speciality: null, is_on_duty: true, status: 'AVAILABLE' },
          ],
        };
      }

      throw new Error(`Unexpected summary query: ${sql}`);
    });
  });

  it('estimates an Any-barber customer from active and waiting workloads', async () => {
    const summary = await SalonService.getPublicSummary();

    expect(summary.stats.waitingCount).toBe(2);
    // (20 active minutes remaining + 50 waiting minutes) / 2 eligible barbers.
    expect(summary.stats.approxWaitMinutes).toBe(35);
  });

  it('returns PostgreSQL numeric service prices as numbers in the API contract', async () => {
    serviceRows = [
      {
        id: 'service-1',
        name_en: 'Haircut',
        name_gu: 'વાળ કાપવા',
        duration_minutes: 30,
        price_inr: '350.00',
        is_enabled: true,
        sort_order: 1,
      },
    ];

    const services = await SalonService.getServices();

    expect(services[0].price_inr).toBe(350);
    expect(typeof services[0].price_inr).toBe('number');
  });
});
