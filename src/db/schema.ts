import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  serial,
  boolean,
  bigint,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────────────

export const mandateStatusEnum = pgEnum('mandate_status', ['active', 'revoked', 'expired']);
export const auditDecisionEnum = pgEnum('audit_decision', ['approved', 'rejected', 'failed']);

// ─── Products ────────────────────────────────────────────────────────

export const products = pgTable('products', {
  id: text('id').primaryKey(), // e.g. "prod_001"
  name: text('name').notNull(),
  category: text('category').notNull(),
  priceInr: integer('price_inr').notNull(), // in paise (₹24.99 = 2499)
  stock: integer('stock').notNull().default(0),
  description: text('description').notNull().default(''),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// ─── Mandates ────────────────────────────────────────────────────────

export const mandates = pgTable('mandates', {
  id: text('id').primaryKey(), // e.g. "mnd_001"
  buyerId: text('buyer_id').notNull(),
  maxSpendInr: integer('max_spend_inr').notNull(), // in paise
  allowedCategories: jsonb('allowed_categories').$type<string[]>().notNull(),
  maxTransactions: integer('max_transactions').notNull(),
  transactionsUsed: integer('transactions_used').notNull().default(0),
  amountSpent: integer('amount_spent').notNull().default(0), // in paise
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: mandateStatusEnum('status').notNull().default('active'),
});

export type Mandate = typeof mandates.$inferSelect;
export type NewMandate = typeof mandates.$inferInsert;

// ─── Audit Logs ──────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  actor: text('actor').notNull(), // e.g. "buyer_agent", "gateway"
  action: text('action').notNull(), // e.g. "purchase_request", "mandate_check"
  mandateId: text('mandate_id'),
  productId: text('product_id'),
  requestedAmount: integer('requested_amount'), // in paise
  decision: auditDecisionEnum('decision').notNull(),
  reason: text('reason').notNull(),
  razorpayOrderId: text('razorpay_order_id'),
  idempotencyKey: text('idempotency_key'),
  agentReasoning: text('agent_reasoning'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ─── Idempotency Keys ───────────────────────────────────────────────

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  response: jsonb('response').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
