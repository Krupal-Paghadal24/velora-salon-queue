import type pg from 'pg';
import { getSalonDateString } from '../utils/date.js';

export interface TokenGenerator {
  nextDailyToken(client: pg.PoolClient | pg.Pool, date?: Date): Promise<number>;
}

/**
 * PostgreSQL Atomic Token Generator.
 * Executes an atomic UPSERT on daily_token_counters strictly keyed by Asia/Kolkata date.
 */
export async function getNextDailyToken(
  db: pg.PoolClient | pg.Pool,
  date: Date = new Date()
): Promise<{ salonDate: string; tokenNumber: number }> {
  const salonDate = getSalonDateString(date);

  const query = `
    INSERT INTO daily_token_counters (salon_date, last_token_number, updated_at)
    VALUES ($1, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (salon_date)
    DO UPDATE SET
      last_token_number = daily_token_counters.last_token_number + 1,
      updated_at = CURRENT_TIMESTAMP
    RETURNING last_token_number;
  `;

  const result = await db.query<{ last_token_number: number }>(query, [salonDate]);
  return {
    salonDate,
    tokenNumber: result.rows[0].last_token_number,
  };
}

/**
 * In-Memory Token Counter simulator for isolated domain testing.
 */
export class InMemoryTokenGenerator {
  private counters: Map<string, number> = new Map();

  getNextDailyToken(date: Date = new Date()): { salonDate: string; tokenNumber: number } {
    const salonDate = getSalonDateString(date);
    const current = this.counters.get(salonDate) || 0;
    const next = current + 1;
    this.counters.set(salonDate, next);
    return { salonDate, tokenNumber: next };
  }

  reset(): void {
    this.counters.clear();
  }
}
