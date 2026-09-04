import { Mandate } from '../../db/schema.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface PurchaseValidationRequest {
  mandateId: string;
  requestedAmount: number; // in paise
  productCategory: string;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string; code: string };

// ─── Pure Validation Functions ───────────────────────────────────────
// These functions are the most safety-critical code in the system.
// They are pure (no side effects), deterministic, and exhaustively tested.

/**
 * Check if a mandate has expired.
 */
export function isExpired(mandate: Mandate, now: Date = new Date()): boolean {
  return now >= new Date(mandate.expiresAt);
}

/**
 * Check if a mandate is currently active (not revoked, not expired).
 */
export function isActive(mandate: Mandate, now: Date = new Date()): boolean {
  return mandate.status === 'active' && !isExpired(mandate, now);
}

/**
 * Check if the requested amount fits within the remaining spend limit.
 */
export function isWithinSpendLimit(mandate: Mandate, requestedAmount: number): boolean {
  const remaining = mandate.maxSpendInr - mandate.amountSpent;
  return requestedAmount <= remaining;
}

/**
 * Get the remaining spend allowance in paise.
 */
export function getRemainingSpend(mandate: Mandate): number {
  return mandate.maxSpendInr - mandate.amountSpent;
}

/**
 * Check if the product category is allowed by the mandate.
 */
export function isCategoryAllowed(mandate: Mandate, category: string): boolean {
  const allowed = mandate.allowedCategories as string[];
  return allowed.includes(category);
}

/**
 * Check if the mandate has remaining transaction capacity.
 */
export function isWithinTransactionLimit(mandate: Mandate): boolean {
  return mandate.transactionsUsed < mandate.maxTransactions;
}

/**
 * Full validation of a purchase request against a mandate.
 * Returns a detailed result with a specific rejection reason if any check fails.
 * Checks are ordered from cheapest to most expensive.
 */
export function validateMandate(
  mandate: Mandate,
  requestedAmount: number,
  productCategory: string,
  now: Date = new Date()
): ValidationResult {
  // 1. Status check
  if (mandate.status === 'revoked') {
    return { valid: false, reason: 'Mandate has been revoked', code: 'MANDATE_REVOKED' };
  }

  // 2. Expiry check
  if (isExpired(mandate, now)) {
    return { valid: false, reason: 'Mandate has expired', code: 'MANDATE_EXPIRED' };
  }

  // 3. Category check
  if (!isCategoryAllowed(mandate, productCategory)) {
    const allowed = (mandate.allowedCategories as string[]).join(', ');
    return {
      valid: false,
      reason: `Category "${productCategory}" is not allowed. Allowed: [${allowed}]`,
      code: 'CATEGORY_NOT_ALLOWED',
    };
  }

  // 4. Transaction limit check
  if (!isWithinTransactionLimit(mandate)) {
    return {
      valid: false,
      reason: `Transaction limit reached (${mandate.transactionsUsed}/${mandate.maxTransactions})`,
      code: 'TRANSACTION_LIMIT_REACHED',
    };
  }

  // 5. Spend limit check
  if (!isWithinSpendLimit(mandate, requestedAmount)) {
    const remaining = getRemainingSpend(mandate);
    const overBy = requestedAmount - remaining;
    return {
      valid: false,
      reason: `Exceeds spend limit by ₹${(overBy / 100).toFixed(2)}. Remaining: ₹${(remaining / 100).toFixed(2)}, Requested: ₹${(requestedAmount / 100).toFixed(2)}`,
      code: 'SPEND_LIMIT_EXCEEDED',
    };
  }

  return { valid: true };
}
