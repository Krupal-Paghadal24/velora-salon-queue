import fs from 'node:fs';
import pg from 'pg';
import { config } from '../config.js';
import { createSslOptions, stripSslMode } from './ssl.js';

const { Pool } = pg;

// Return DATE columns (salon_date) as plain 'YYYY-MM-DD' strings instead of JS Dates (avoids timezone shifts).
pg.types.setTypeParser(1082, (v: string) => v);

function createPool(connectionString?: string, maxClients: number = 10): pg.Pool | null {
  if (!connectionString) {
    return null;
  }

  const sslMode = new URL(connectionString).searchParams.get('sslmode');
  const isSsl = sslMode === 'require' || config.NODE_ENV === 'production' || Boolean(config.DATABASE_SSL_CA);
  let caCertificate: string | undefined;

  if (config.DATABASE_SSL_CA) {
    try {
      caCertificate = fs.readFileSync(config.DATABASE_SSL_CA, 'utf8');
    } catch {
      throw new Error('Could not read the configured DATABASE_SSL_CA certificate file.');
    }
  }

  const ssl = isSsl ? createSslOptions(caCertificate, config.NODE_ENV === 'production') : undefined;

  // pg-connection-string replaces the explicit SSL object when sslmode is in the URL.
  // Remove it here so TLS options below remain authoritative.
  return new Pool({
    connectionString: isSsl ? stripSslMode(connectionString) : connectionString,
    max: maxClients,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl,
  });
}

// Runtime Pool (Transaction pooler, Port 6543)
export const runtimePool = createPool(config.DATABASE_URL, 10);

// Migration Pool (Session pooler, Port 5432)
export function createMigrationPool(migrationUrl?: string): pg.Pool | null {
  return createPool(migrationUrl, 3);
}

export function requireMigrationPool(pool: pg.Pool | null): pg.Pool {
  if (!pool) {
    throw new Error('MIGRATION_URL is required for database migration and seed operations.');
  }
  return pool;
}

export const migrationPool = createMigrationPool(config.MIGRATION_URL);

/**
 * Execute a query with the runtime pool, or throw helpful error if DATABASE_URL is not configured.
 */
export async function query<R extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<R>> {
  if (!runtimePool) {
    throw new Error('DATABASE_URL is not set. Please configure your Supabase connection string.');
  }
  return runtimePool.query<R>(text, params);
}

/**
 * Acquire a client from the runtime pool for transactional operations.
 */
export async function getClient(): Promise<pg.PoolClient> {
  if (!runtimePool) {
    throw new Error('DATABASE_URL is not set. Please configure your Supabase connection string.');
  }
  return runtimePool.connect();
}
