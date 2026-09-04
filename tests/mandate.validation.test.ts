import { describe, it, expect } from 'vitest';
import {
  isExpired,
  isActive,
  isWithinSpendLimit,
  isCategoryAllowed,
  isWithinTransactionLimit,
  getRemainingSpend,
  validateMandate,
} from '../src/services/mandate/mandate.validation.js';
import { Mandate } from '../src/db/schema.js';

// ─── Test Fixtures ───────────────────────────────────────────────────

function createMockMandate(overrides: Partial<Mandate> = {}): Mandate {
  return {
    id: 'mnd_test_001',
    buyerId: 'buyer_test',
    maxSpendInr: 500000, // ₹5,000.00
    allowedCategories: ['sports', 'fitness'],
    maxTransactions: 3,
    transactionsUsed: 0,
    amountSpent: 0,
    issuedAt: new Date('2026-09-01T00:00:00Z'),
    expiresAt: new Date('2026-09-30T23:59:59Z'),
    status: 'active',
    ...overrides,
  };
}

// ─── isExpired ────────────────────────────────────────────────────────

describe('isExpired', () => {
  it('returns false when mandate is not expired', () => {
    const mandate = createMockMandate({
      expiresAt: new Date('2026-12-31T23:59:59Z'),
    });
    const now = new Date('2026-09-01T12:00:00Z');
    expect(isExpired(mandate, now)).toBe(false);
  });

  it('returns true when mandate has expired', () => {
    const mandate = createMockMandate({
      expiresAt: new Date('2026-08-01T00:00:00Z'),
    });
    const now = new Date('2026-09-01T12:00:00Z');
    expect(isExpired(mandate, now)).toBe(true);
  });

  it('returns true when now equals expiry (boundary)', () => {
    const expiry = new Date('2026-09-01T12:00:00Z');
    const mandate = createMockMandate({ expiresAt: expiry });
    expect(isExpired(mandate, expiry)).toBe(true);
  });

  it('returns false when 1ms before expiry', () => {
    const expiry = new Date('2026-09-01T12:00:00Z');
    const mandate = createMockMandate({ expiresAt: expiry });
    const justBefore = new Date(expiry.getTime() - 1);
    expect(isExpired(mandate, justBefore)).toBe(false);
  });
});

// ─── isActive ─────────────────────────────────────────────────────────

describe('isActive', () => {
  it('returns true for active, non-expired mandate', () => {
    const mandate = createMockMandate();
    const now = new Date('2026-09-15T12:00:00Z');
    expect(isActive(mandate, now)).toBe(true);
  });

  it('returns false for revoked mandate', () => {
    const mandate = createMockMandate({ status: 'revoked' });
    const now = new Date('2026-09-15T12:00:00Z');
    expect(isActive(mandate, now)).toBe(false);
  });

  it('returns false for expired mandate (even if status is active)', () => {
    const mandate = createMockMandate({
      status: 'active',
      expiresAt: new Date('2026-08-01T00:00:00Z'),
    });
    const now = new Date('2026-09-15T12:00:00Z');
    expect(isActive(mandate, now)).toBe(false);
  });
});

// ─── isWithinSpendLimit ──────────────────────────────────────────────

describe('isWithinSpendLimit', () => {
  it('returns true when amount is within limit', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 0 });
    expect(isWithinSpendLimit(mandate, 249900)).toBe(true);
  });

  it('returns true when amount exactly equals remaining', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 250100 });
    expect(isWithinSpendLimit(mandate, 249900)).toBe(true);
  });

  it('returns false when amount exceeds remaining', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 400000 });
    expect(isWithinSpendLimit(mandate, 200000)).toBe(false);
  });

  it('returns false when already at limit', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 500000 });
    expect(isWithinSpendLimit(mandate, 1)).toBe(false);
  });

  it('returns true for zero-cost item', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 500000 });
    expect(isWithinSpendLimit(mandate, 0)).toBe(true);
  });
});

// ─── getRemainingSpend ───────────────────────────────────────────────

describe('getRemainingSpend', () => {
  it('returns full amount when nothing spent', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 0 });
    expect(getRemainingSpend(mandate)).toBe(500000);
  });

  it('returns correct remaining after partial spend', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 249900 });
    expect(getRemainingSpend(mandate)).toBe(250100);
  });

  it('returns zero when fully spent', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 500000 });
    expect(getRemainingSpend(mandate)).toBe(0);
  });
});

// ─── isCategoryAllowed ───────────────────────────────────────────────

describe('isCategoryAllowed', () => {
  it('returns true for allowed category', () => {
    const mandate = createMockMandate({ allowedCategories: ['sports', 'fitness'] });
    expect(isCategoryAllowed(mandate, 'sports')).toBe(true);
  });

  it('returns true for second allowed category', () => {
    const mandate = createMockMandate({ allowedCategories: ['sports', 'fitness'] });
    expect(isCategoryAllowed(mandate, 'fitness')).toBe(true);
  });

  it('returns false for disallowed category', () => {
    const mandate = createMockMandate({ allowedCategories: ['sports', 'fitness'] });
    expect(isCategoryAllowed(mandate, 'electronics')).toBe(false);
  });

  it('is case-sensitive', () => {
    const mandate = createMockMandate({ allowedCategories: ['sports'] });
    expect(isCategoryAllowed(mandate, 'Sports')).toBe(false);
  });
});

// ─── isWithinTransactionLimit ────────────────────────────────────────

describe('isWithinTransactionLimit', () => {
  it('returns true when no transactions used', () => {
    const mandate = createMockMandate({ maxTransactions: 3, transactionsUsed: 0 });
    expect(isWithinTransactionLimit(mandate)).toBe(true);
  });

  it('returns true when under limit', () => {
    const mandate = createMockMandate({ maxTransactions: 3, transactionsUsed: 2 });
    expect(isWithinTransactionLimit(mandate)).toBe(true);
  });

  it('returns false when at limit', () => {
    const mandate = createMockMandate({ maxTransactions: 3, transactionsUsed: 3 });
    expect(isWithinTransactionLimit(mandate)).toBe(false);
  });

  it('returns false when over limit', () => {
    const mandate = createMockMandate({ maxTransactions: 3, transactionsUsed: 5 });
    expect(isWithinTransactionLimit(mandate)).toBe(false);
  });
});

// ─── validateMandate (composite) ─────────────────────────────────────

describe('validateMandate', () => {
  const now = new Date('2026-09-15T12:00:00Z');

  it('returns valid when all checks pass', () => {
    const mandate = createMockMandate();
    const result = validateMandate(mandate, 249900, 'sports', now);
    expect(result).toEqual({ valid: true });
  });

  it('rejects revoked mandates', () => {
    const mandate = createMockMandate({ status: 'revoked' });
    const result = validateMandate(mandate, 249900, 'sports', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('MANDATE_REVOKED');
    }
  });

  it('rejects expired mandates', () => {
    const mandate = createMockMandate({
      expiresAt: new Date('2026-09-01T00:00:00Z'),
    });
    const result = validateMandate(mandate, 249900, 'sports', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('MANDATE_EXPIRED');
    }
  });

  it('rejects disallowed categories', () => {
    const mandate = createMockMandate({ allowedCategories: ['sports'] });
    const result = validateMandate(mandate, 249900, 'electronics', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('CATEGORY_NOT_ALLOWED');
      expect(result.reason).toContain('electronics');
    }
  });

  it('rejects when transaction limit reached', () => {
    const mandate = createMockMandate({ maxTransactions: 3, transactionsUsed: 3 });
    const result = validateMandate(mandate, 249900, 'sports', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('TRANSACTION_LIMIT_REACHED');
    }
  });

  it('rejects when spend limit exceeded', () => {
    const mandate = createMockMandate({ maxSpendInr: 200000, amountSpent: 0 });
    const result = validateMandate(mandate, 300000, 'sports', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('SPEND_LIMIT_EXCEEDED');
      expect(result.reason).toContain('₹1000.00'); // over by ₹1000
    }
  });

  it('rejects revoked before checking other bounds (priority order)', () => {
    const mandate = createMockMandate({
      status: 'revoked',
      maxSpendInr: 100, // would also fail spend check
    });
    const result = validateMandate(mandate, 999999, 'electronics', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('MANDATE_REVOKED'); // Not SPEND_LIMIT_EXCEEDED
    }
  });

  it('approves when amount exactly equals remaining spend', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 250100 });
    const result = validateMandate(mandate, 249900, 'sports', now);
    expect(result).toEqual({ valid: true });
  });

  it('rejects when amount is 1 paise over remaining', () => {
    const mandate = createMockMandate({ maxSpendInr: 500000, amountSpent: 250101 });
    const result = validateMandate(mandate, 249900, 'sports', now);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe('SPEND_LIMIT_EXCEEDED');
    }
  });
});
