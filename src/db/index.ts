import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Connection for queries (pooled)
const queryClient = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

// Connection for migrations (single, non-pooled)
export function getMigrationClient() {
  return postgres(config.DATABASE_URL, { max: 1 });
}

export async function testConnection(): Promise<void> {
  try {
    await queryClient`SELECT 1`;
    logger.info('✅ Database connection established');
  } catch (error) {
    logger.error({ err: error }, '❌ Database connection failed');
    throw error;
  }
}
