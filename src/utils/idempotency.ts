import { db } from '../db/index.js';
import { idempotencyKeys } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from './logger.js';

export interface IdempotencyResult<T> {
  cached: boolean;
  response: T;
}

/**
 * Check if an idempotency key has already been processed.
 * Returns the cached response if found, null otherwise.
 */
export async function getIdempotencyResponse<T = Record<string, unknown>>(
  key: string
): Promise<T | null> {
  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (existing) {
    logger.info({ idempotencyKey: key }, 'Returning cached idempotent response');
    return existing.response as T;
  }

  return null;
}

/**
 * Store a response for an idempotency key.
 */
export async function storeIdempotencyResponse(
  key: string,
  response: Record<string, unknown>
): Promise<void> {
  await db.insert(idempotencyKeys).values({
    key,
    response,
  }).onConflictDoNothing();
}
