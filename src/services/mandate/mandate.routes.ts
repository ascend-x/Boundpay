import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createMandate,
  getMandateById,
  listMandatesByBuyer,
  listAllMandates,
  revokeMandate,
} from './mandate.service.js';
import { BusinessError } from '../../middleware/error-handler.js';

export async function mandateRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /mandates
   * Create a new mandate (human-issued via frontend).
   */
  app.post('/', async (request: FastifyRequest<{
    Body: {
      buyerId: string;
      maxSpendInr: number;
      allowedCategories: string[];
      maxTransactions: number;
      expiresAt: string;
    };
  }>, reply: FastifyReply) => {
    const body = request.body;

    if (!body || !body.buyerId || !body.maxSpendInr || !body.allowedCategories || !body.maxTransactions || !body.expiresAt) {
      throw new BusinessError(400, 'MISSING_FIELDS', 'Required fields: buyerId, maxSpendInr, allowedCategories, maxTransactions, expiresAt');
    }

    const mandate = await createMandate(body);

    return reply.status(201).send({
      success: true,
      data: mandate,
    });
  });

  /**
   * GET /mandates
   * List mandates. Optional ?buyer_id=X filter, otherwise list all.
   */
  app.get('/', async (request: FastifyRequest<{
    Querystring: { buyer_id?: string };
  }>, reply: FastifyReply) => {
    const { buyer_id } = request.query;

    const items = buyer_id
      ? await listMandatesByBuyer(buyer_id)
      : await listAllMandates();

    return reply.send({
      success: true,
      data: items,
      count: items.length,
    });
  });

  /**
   * GET /mandates/:id
   * Get a single mandate by ID.
   */
  app.get('/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const mandate = await getMandateById(id);

    if (!mandate) {
      throw new BusinessError(404, 'MANDATE_NOT_FOUND', `Mandate ${id} not found`);
    }

    return reply.send({
      success: true,
      data: mandate,
    });
  });

  /**
   * POST /mandates/:id/revoke
   * Revoke a mandate early.
   */
  app.post('/:id/revoke', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const mandate = await revokeMandate(id);

    return reply.send({
      success: true,
      data: mandate,
      message: 'Mandate revoked successfully',
    });
  });
}
