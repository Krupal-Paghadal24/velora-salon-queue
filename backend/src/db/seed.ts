import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationPool, requireMigrationPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSeed(): Promise<void> {
  const client = await requireMigrationPool(migrationPool).connect();
  try {
    console.log('[Seed] Connecting to execute idempotent demo seed data...');
    const seedFile = path.join(__dirname, 'migrations', '002_seed_demo_data.sql');

    if (!fs.existsSync(seedFile)) {
      throw new Error(`Seed file not found: ${seedFile}`);
    }

    const sql = fs.readFileSync(seedFile, 'utf-8');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('[Seed] Successfully seeded demo salon data, services, barbers, and staff users.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed] Failed to seed demo data:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
