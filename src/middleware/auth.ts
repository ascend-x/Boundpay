import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { BusinessError } from './error-handler.js';

/**
 * API key authentication for Gateway routes.
 * Checks the x-api-key header against the configured GATEWAY_API_KEY.
 */
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey) {
    throw new BusinessError(401, 'AUTH_MISSING', 'Missing x-api-key header');
  }

  if (apiKey !== config.GATEWAY_API_KEY) {
    throw new BusinessError(403, 'AUTH_INVALID', 'Invalid API key');
  }
}
