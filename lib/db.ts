import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Create Drizzle instance
export const db = drizzle(process.env.DATABASE_URL!, { schema });
