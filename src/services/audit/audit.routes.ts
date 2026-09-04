import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryAuditLogs, getAuditStats } from './audit.service.js';

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /audit
   * Query audit logs with optional filters.
   */
  app.get('/', async (request: FastifyRequest<{
    Querystring: {
      buyer_id?: string;
      mandate_id?: string;
      decision?: 'approved' | 'rejected' | 'failed';
      from?: string;
      to?: string;
      limit?: string;
    };
  }>, reply: FastifyReply) => {
    const { buyer_id, mandate_id, decision, from, to, limit } = request.query;

    const logs = await queryAuditLogs({
      buyerId: buyer_id,
      mandateId: mandate_id,
      decision,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return reply.send({
      success: true,
      data: logs,
      count: logs.length,
    });
  });

  /**
   * GET /audit/stats
   * Get aggregate audit stats.
   */
  app.get('/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await getAuditStats();

    return reply.send({
      success: true,
      data: stats,
    });
  });
}
