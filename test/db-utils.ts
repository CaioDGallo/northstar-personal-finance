import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/lib/schema';
import fs from 'fs';
import path from 'path';

let pglite: PGlite;
let db: ReturnType<typeof drizzle>;

export async function setupTestDb() {
  // Create in-memory PostgreSQL
  pglite = new PGlite();
  db = drizzle(pglite, { schema });

  // Run migrations from SQL files
  const migrationsDir = path.join(process.cwd(), 'drizzle');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pglite.exec(migrationSql);
  }

  return db;
}

export async function teardownTestDb() {
  if (pglite) {
    await pglite.close();
  }
}

export async function clearAllTables() {
  // Clear in reverse FK order to avoid constraint violations
  await db.delete(schema.notificationJobs);
  await db.delete(schema.notifications);
  await db.delete(schema.recurrenceRules);
  await db.delete(schema.income);
  await db.delete(schema.entries);
  await db.delete(schema.transactions);
  await db.delete(schema.budgets);
  await db.delete(schema.monthlyBudgets);
  await db.delete(schema.events);
  await db.delete(schema.categories);
  await db.delete(schema.accounts);
}

export function getTestDb() {
  return db;
}
