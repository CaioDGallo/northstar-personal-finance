import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Create Turso client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:./local.db',
  // authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create Drizzle instance
export const db = drizzle(client, { schema });
