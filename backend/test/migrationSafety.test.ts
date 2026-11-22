import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createMigrationPool, requireMigrationPool } from '../src/db/pool.js';

const migrationDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');

describe('Database migration safety', () => {
  it('does not create a migration pool when MIGRATION_URL is missing', () => {
    expect(createMigrationPool(undefined)).toBeNull();
  });

  it('fails clearly when a migration or seed operation has no migration pool', () => {
    expect(() => requireMigrationPool(null)).toThrow(
      'MIGRATION_URL is required for database migration and seed operations.'
    );
  });

  it('preserves existing salon settings when demo seed data is rerun', () => {
    const seedSql = fs.readFileSync(path.join(migrationDir, '002_seed_demo_data.sql'), 'utf8');
    const settingsInsert = seedSql.match(/INSERT INTO salon_settings[\s\S]*?;\s/)?.[0];

    expect(settingsInsert).toContain('ON CONFLICT (id) DO NOTHING');
    expect(settingsInsert).not.toContain('DO UPDATE');
  });
});
