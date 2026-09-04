import { db } from '../../db/index.js';
import { mandates, products } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { getMandateById } from '../mandate/mandate.service.js';
import { getProductById } from '../catalog/catalog.service.js';
import { validateMandate } from '../mandate/mandate.validation.js';
import { writeAuditLog } from '../audit/audit.service.js';
import { createOrder } from './razorpay.client.js';
import { getIdempotencyResponse, storeIdempotencyResponse } from '../../utils/idempotency.js';
import { logger } from '../../utils/logger.js';
import { BusinessError } from '../../middleware/error-handler.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface PurchaseRequest {
  mandateId: string;
  buyerId: string;
  productId: string;
  requestedAmount: number; // in paise
  agentReasoning: string;
  idempotencyKey: string;
}

export interface PurchaseResult {
  status: 'approved' | 'rejected' | 'failed' | 'pending_human_review';
  orderId?: string;
  reason: string;
  product?: {
    id: string;
    name: string;
    priceInr: number;
  };
  mandate?: {
    id: string;
    remainingSpend: number;
    transactionsRemaining: number;
  };
}

// ─── Gateway Service ─────────────────────────────────────────────────

/**
 * Process a purchase request through the two-phase flow.
 * This is the single enforcement point — deterministic, not LLM-driven.
 */
export async function processPurchase(request: PurchaseRequest): Promise<PurchaseResult> {
  const { mandateId, buyerId, productId, requestedAmount, agentReasoning, idempotencyKey } = request;

  logger.info(
    { mandateId, buyerId, productId, amount: requestedAmount, idempotencyKey },
    'Processing purchase request'
  );

  // ─── Idempotency Check ────────────────────────────────────────────
  const cached = await getIdempotencyResponse<PurchaseResult>(idempotencyKey);
  if (cached) {
    return cached;
  }

  // ─── Phase 1: Validate + Reserve (conceptual transaction) ─────────

  // 1. Fetch mandate
  const mandate = await getMandateById(mandateId);
  if (!mandate) {
    const result = await rejectPurchase(request, 'MANDATE_NOT_FOUND', `Mandate ${mandateId} not found`);
    return result;
  }

  // Verify buyer owns this mandate
  if (mandate.buyerId !== buyerId) {
    const result = await rejectPurchase(request, 'MANDATE_BUYER_MISMATCH', 'Mandate does not belong to this buyer');
    return result;
  }

  // 2. Fetch product
  const product = await getProductById(productId);
  if (!product) {
    const result = await rejectPurchase(request, 'PRODUCT_NOT_FOUND', `Product ${productId} not found`);
    return result;
  }

  // 3. Verify requested amount matches actual price (prevent tampering)
  if (requestedAmount !== product.priceInr) {
    const result = await rejectPurchase(
      request,
      'PRICE_MISMATCH',
      `Requested amount (₹${(requestedAmount / 100).toFixed(2)}) does not match product price (₹${(product.priceInr / 100).toFixed(2)})`
    );
    return result;
  }

  // 4. Check stock
  if (product.stock <= 0) {
    const result = await rejectPurchase(request, 'OUT_OF_STOCK', `Product "${product.name}" is out of stock`);
    return result;
  }

  // 5. Validate mandate bounds
  const validation = validateMandate(mandate, requestedAmount, product.category);
  if (!validation.valid) {
    const result = await rejectPurchase(request, validation.code, validation.reason);
    return result;
  }

  // 5.5 Human-in-the-Loop (HITL) Interception
  // If the agent is trying to consume >= 90% of the remaining budget in one shot, flag it for human review.
  const remainingBudget = mandate.maxSpendInr - mandate.amountSpent;
  if (requestedAmount >= remainingBudget * 0.90) {
    const result = await pendingPurchase(
      request, 
      `High-value transaction (₹${(requestedAmount / 100).toFixed(2)}) requires manual human approval as it consumes >= 90% of remaining mandate budget.`
    );
    return result;
  }

  // 6. Reserve: update mandate + stock atomically
  try {
    await db.transaction(async (tx) => {
      // Increment mandate usage
      await tx
        .update(mandates)
        .set({
          transactionsUsed: sql`${mandates.transactionsUsed} + 1`,
          amountSpent: sql`${mandates.amountSpent} + ${requestedAmount}`,
        })
        .where(eq(mandates.id, mandateId));

      // Decrement stock
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - 1`,
        })
        .where(eq(products.id, productId));
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to reserve (DB transaction)');
    const result = await failPurchase(request, 'Reservation failed — database error');
    return result;
  }

  // ─── Phase 2: Execute Razorpay call (outside transaction) ─────────

  try {
    const order = await createOrder({
      amountPaise: requestedAmount,
      receipt: `rcpt_${idempotencyKey}`,
      notes: {
        mandate_id: mandateId,
        buyer_id: buyerId,
        product_id: productId,
        agent_reasoning: agentReasoning.substring(0, 500), // Razorpay note limit
      },
    });

    // Success — write audit log
    const result: PurchaseResult = {
      status: 'approved',
      orderId: order.id,
      reason: 'Purchase approved — all mandate bounds satisfied',
      product: {
        id: product.id,
        name: product.name,
        priceInr: product.priceInr,
      },
      mandate: {
        id: mandate.id,
        remainingSpend: mandate.maxSpendInr - mandate.amountSpent - requestedAmount,
        transactionsRemaining: mandate.maxTransactions - mandate.transactionsUsed - 1,
      },
    };

    await writeAuditLog({
      actor: buyerId,
      action: 'purchase_request',
      mandateId,
      productId,
      requestedAmount,
      decision: 'approved',
      reason: result.reason,
      razorpayOrderId: order.id,
      idempotencyKey,
      agentReasoning,
    });

    await storeIdempotencyResponse(idempotencyKey, result as unknown as Record<string, unknown>);
    logger.info({ orderId: order.id, mandateId }, 'Purchase approved ✅');

    // ─── Asynchronous Webhook Simulation ───
    // In a real e-commerce ecosystem, we would fire a webhook to the merchant's backend 
    // so they are notified out-of-band that the AI agent completed an order.
    setTimeout(() => {
      logger.info({
        event: 'order.created',
        orderId: order.id,
        productId: product.id,
        amount: requestedAmount,
        webhookUrl: 'https://merchant-api.example.com/webhooks/agentic-commerce'
      }, '⚡ [WEBHOOK FIRED] Merchant notified of successful AI purchase');
    }, 1000);

    return result;
  } catch (error: any) {
    // Razorpay failed — compensate: reverse the reservation
    logger.error({ err: error }, 'Razorpay call failed — compensating reservation');

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(mandates)
          .set({
            transactionsUsed: sql`${mandates.transactionsUsed} - 1`,
            amountSpent: sql`${mandates.amountSpent} - ${requestedAmount}`,
          })
          .where(eq(mandates.id, mandateId));

        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + 1`,
          })
          .where(eq(products.id, productId));
      });
    } catch (compensateError) {
      logger.error({ err: compensateError }, 'CRITICAL: Compensation failed — manual intervention required');
    }

    const result = await failPurchase(request, `Razorpay error: ${error?.message || 'Unknown'}`);
    return result;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function rejectPurchase(request: PurchaseRequest, code: string, reason: string): Promise<PurchaseResult> {
  const result: PurchaseResult = {
    status: 'rejected',
    reason,
  };

  await writeAuditLog({
    actor: request.buyerId,
    action: 'purchase_request',
    mandateId: request.mandateId,
    productId: request.productId,
    requestedAmount: request.requestedAmount,
    decision: 'rejected',
    reason: `[${code}] ${reason}`,
    idempotencyKey: request.idempotencyKey,
    agentReasoning: request.agentReasoning,
  });

  await storeIdempotencyResponse(request.idempotencyKey, result as unknown as Record<string, unknown>);
  logger.warn({ code, mandateId: request.mandateId }, `Purchase rejected: ${reason}`);
  return result;
}

async function failPurchase(request: PurchaseRequest, reason: string): Promise<PurchaseResult> {
  const result: PurchaseResult = {
    status: 'failed',
    reason,
  };

  await writeAuditLog({
    actor: request.buyerId,
    action: 'purchase_request',
    mandateId: request.mandateId,
    productId: request.productId,
    requestedAmount: request.requestedAmount,
    decision: 'failed',
    reason,
    idempotencyKey: request.idempotencyKey,
    agentReasoning: request.agentReasoning,
  });

  await storeIdempotencyResponse(request.idempotencyKey, result as unknown as Record<string, unknown>);
  logger.error({ mandateId: request.mandateId }, `Purchase failed: ${reason}`);
  return result;
}

async function pendingPurchase(request: PurchaseRequest, reason: string): Promise<PurchaseResult> {
  const result: PurchaseResult = {
    status: 'pending_human_review',
    reason,
  };

  await writeAuditLog({
    actor: request.buyerId,
    action: 'purchase_request',
    mandateId: request.mandateId,
    productId: request.productId,
    requestedAmount: request.requestedAmount,
    decision: 'rejected', // In DB, it's rejected for now since we don't have a pending status enum there, but we log the HITL reason
    reason: `[HITL_REQUIRED] ${reason}`,
    idempotencyKey: request.idempotencyKey,
    agentReasoning: request.agentReasoning,
  });

  await storeIdempotencyResponse(request.idempotencyKey, result as unknown as Record<string, unknown>);
  logger.warn({ mandateId: request.mandateId }, `Purchase intercepted for HITL review: ${reason}`);
  return result;
}
