import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Push schema directly to the database (for development).
 * In production, use drizzle-kit generate + migrate.
 */
export async function pushSchema(): Promise<void> {
  logger.info('Running schema push...');

  // Create enums
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE mandate_status AS ENUM ('active', 'revoked', 'expired');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE audit_decision AS ENUM ('approved', 'rejected', 'failed');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Create products table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_inr INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Create mandates table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mandates (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      max_spend_inr INTEGER NOT NULL,
      allowed_categories JSONB NOT NULL,
      max_transactions INTEGER NOT NULL,
      transactions_used INTEGER NOT NULL DEFAULT 0,
      amount_spent INTEGER NOT NULL DEFAULT 0,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      status mandate_status NOT NULL DEFAULT 'active'
    );
  `);

  // Create audit_logs table (append-only)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      mandate_id TEXT,
      product_id TEXT,
      requested_amount INTEGER,
      decision audit_decision NOT NULL,
      reason TEXT NOT NULL,
      razorpay_order_id TEXT,
      idempotency_key TEXT,
      agent_reasoning TEXT,
      metadata JSONB
    );
  `);

  // Create idempotency_keys table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_mandates_buyer_id ON mandates (buyer_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_mandate_id ON audit_logs (mandate_id);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_buyer ON audit_logs (actor);
  `);

  logger.info('✅ Schema push complete');
}
