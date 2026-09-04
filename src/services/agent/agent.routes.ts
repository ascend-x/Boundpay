import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { executeGoal } from './agent.service.js';
import { BusinessError } from '../../middleware/error-handler.js';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /agent/execute-goal
   * Execute a buyer agent goal.
   */
  app.post('/execute-goal', async (request: FastifyRequest<{
    Body: {
      buyer_id: string;
      mandate_id: string;
      goal: string;
    };
  }>, reply: FastifyReply) => {
    const body = request.body;

    if (!body || !body.buyer_id || !body.mandate_id || !body.goal) {
      throw new BusinessError(
        400,
        'MISSING_FIELDS',
        'Required fields: buyer_id, mandate_id, goal'
      );
    }

    const result = await executeGoal({
      buyerId: body.buyer_id,
      mandateId: body.mandate_id,
      goal: body.goal,
    });

    // Always return 200 OK because the structured execution trace is successfully generated
    // regardless of whether the agent achieved the goal or failed/rejected.
    return reply.status(200).send({
      success: result.finalStatus === 'success',
      data: result,
    });
  });
}
