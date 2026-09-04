import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processPurchase, PurchaseRequest } from './gateway.service.js';
import { apiKeyAuth } from '../../middleware/auth.js';
import { BusinessError } from '../../middleware/error-handler.js';

export async function gatewayRoutes(app: FastifyInstance): Promise<void> {
  // Apply API key auth to all gateway routes
  app.addHook('onRequest', apiKeyAuth);

  /**
   * POST /gateway/purchase
   * Process a purchase request through the bounded gateway.
   * Requires x-api-key and x-idempotency-key headers.
   */
  app.post('/purchase', async (request: FastifyRequest<{
    Body: {
      mandate_id: string;
      buyer_id: string;
      product_id: string;
      requested_amount: number;
      agent_reasoning: string;
    };
  }>, reply: FastifyReply) => {
    const idempotencyKey = request.headers['x-idempotency-key'] as string;

    if (!idempotencyKey) {
      throw new BusinessError(400, 'MISSING_IDEMPOTENCY_KEY', 'x-idempotency-key header is required');
    }

    const body = request.body;
    if (!body || !body.mandate_id || !body.buyer_id || !body.product_id || body.requested_amount == null || !body.agent_reasoning) {
      throw new BusinessError(
        400,
        'MISSING_FIELDS',
        'Required fields: mandate_id, buyer_id, product_id, requested_amount, agent_reasoning'
      );
    }

    const purchaseRequest: PurchaseRequest = {
      mandateId: body.mandate_id,
      buyerId: body.buyer_id,
      productId: body.product_id,
      requestedAmount: body.requested_amount,
      agentReasoning: body.agent_reasoning,
      idempotencyKey,
    };

    const result = await processPurchase(purchaseRequest);

    if (result.status === 'approved') {
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } else if (result.status === 'pending_human_review') {
      return reply.status(202).send({
        success: true,
        message: 'Transaction intercepted for Human-in-the-Loop review.',
        data: result,
      });
    } else {
      const statusCode = result.status === 'rejected' ? 422 : 502;
      return reply.status(statusCode).type('application/problem+json').send({
        type: `https://api.agenticcommerce.com/errors/purchase-${result.status}`,
        title: `Purchase ${result.status.charAt(0).toUpperCase() + result.status.slice(1)}`,
        status: statusCode,
        detail: result.reason,
        instance: `/gateway/purchase/${idempotencyKey}`,
      });
    }
  });
}
