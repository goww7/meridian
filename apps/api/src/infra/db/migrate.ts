import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../../../migrations');

async function migrate() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://meridian:meridian@localhost:5432/meridian',
  });
  await client.connect();

  // Create migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Get executed migrations
  const executed = await client.query('SELECT name FROM _migrations ORDER BY name');
  const executedNames = new Set(executed.rows.map((r: { name: string }) => r.name));

  // Get migration files
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (executedNames.has(file)) continue;

    console.log(`Running migration: ${file}`);
    const sql = await readFile(join(migrationsDir, file), 'utf-8');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ✓ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ ${file}:`, err);
      process.exit(1);
    }
  }

  console.log('All migrations complete.');
  await client.end();
}

migrate();
