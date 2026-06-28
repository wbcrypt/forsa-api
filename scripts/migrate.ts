/**
 * FORSA OS — Migration Runner
 * Runs SQL migration files in order against the database.
 *
 *   ts-node scripts/migrate.ts
 *
 * Safe to re-run — tracks applied migrations in a migrations table.
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  username: process.env.DB_MIGRATION_USER,
  password: process.env.DB_MIGRATION_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

async function main() {
  await ds.initialize();
  console.log('Connected to database');

  // Create migrations tracking table if it doesn't exist
  await ds.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get list of applied migrations
  const applied = await ds.query<{ filename: string }[]>(
    'SELECT filename FROM _migrations ORDER BY id',
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Read migration files in order
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  ↷ ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`  ▶ Applying ${file}...`);

    try {
      await ds.query(sql);
      await ds.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓ ${file}`);
      ran++;
    } catch (err) {
      console.error(`  ✗ ${file} FAILED:`, (err as Error).message);
      process.exit(1);
    }
  }

  console.log(`\nDone. ${ran} migration(s) applied.`);
  await ds.destroy();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
