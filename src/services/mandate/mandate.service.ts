import { db } from '../../db/index.js';
import { mandates, Mandate, NewMandate } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logger } from '../../utils/logger.js';
import { BusinessError } from '../../middleware/error-handler.js';

/**
 * Create a new mandate (human-issued).
 */
export async function createMandate(input: {
  buyerId: string;
  maxSpendInr: number;
  allowedCategories: string[];
  maxTransactions: number;
  expiresAt: string; // ISO 8601
}): Promise<Mandate> {
  const id = `mnd_${nanoid(12)}`;
  const expiresAt = new Date(input.expiresAt);

  if (expiresAt <= new Date()) {
    throw new BusinessError(400, 'INVALID_EXPIRY', 'Expiry date must be in the future');
  }

  if (input.maxSpendInr <= 0) {
    throw new BusinessError(400, 'INVALID_SPEND_LIMIT', 'Max spend must be positive');
  }

  if (input.maxTransactions <= 0) {
    throw new BusinessError(400, 'INVALID_TRANSACTION_LIMIT', 'Max transactions must be positive');
  }

  if (input.allowedCategories.length === 0) {
    throw new BusinessError(400, 'INVALID_CATEGORIES', 'At least one category must be allowed');
  }

  const [mandate] = await db
    .insert(mandates)
    .values({
      id,
      buyerId: input.buyerId,
      maxSpendInr: input.maxSpendInr,
      allowedCategories: input.allowedCategories,
      maxTransactions: input.maxTransactions,
      expiresAt,
    })
    .returning();

  logger.info({ mandateId: id, buyerId: input.buyerId }, 'Mandate created');
  return mandate;
}

/**
 * Get a mandate by ID.
 */
export async function getMandateById(id: string): Promise<Mandate | null> {
  const [mandate] = await db
    .select()
    .from(mandates)
    .where(eq(mandates.id, id))
    .limit(1);

  return mandate ?? null;
}

/**
 * List mandates for a buyer.
 */
export async function listMandatesByBuyer(buyerId: string): Promise<Mandate[]> {
  return db
    .select()
    .from(mandates)
    .where(eq(mandates.buyerId, buyerId));
}

/**
 * List all mandates.
 */
export async function listAllMandates(): Promise<Mandate[]> {
  return db.select().from(mandates);
}

/**
 * Revoke a mandate early.
 */
export async function revokeMandate(id: string): Promise<Mandate> {
  const mandate = await getMandateById(id);

  if (!mandate) {
    throw new BusinessError(404, 'MANDATE_NOT_FOUND', `Mandate ${id} not found`);
  }

  if (mandate.status !== 'active') {
    throw new BusinessError(400, 'MANDATE_NOT_ACTIVE', `Mandate ${id} is already ${mandate.status}`);
  }

  const [updated] = await db
    .update(mandates)
    .set({ status: 'revoked' })
    .where(eq(mandates.id, id))
    .returning();

  logger.info({ mandateId: id }, 'Mandate revoked');
  return updated;
}
