const fs = require('fs');
const path = require('path');
const db = require('./index');

async function runMigrations() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    const executedRes = await client.query('SELECT name FROM migrations');
    const executedFiles = new Set(executedRes.rows.map(r => r.name));

    for (const file of files) {
      if (!executedFiles.has(file)) {
        console.log(`Executing migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        console.log(`Completed migration: ${file}`);
      } else {
        console.log(`Migration already executed: ${file}`);
      }
    }

    await client.query('COMMIT');
    console.log('All migrations executed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigrations();
