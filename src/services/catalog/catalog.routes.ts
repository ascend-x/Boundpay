import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listProducts, getProductById } from './catalog.service.js';
import { BusinessError } from '../../middleware/error-handler.js';

import { apiKeyAuth } from '../../middleware/auth.js';

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  // Apply API key auth to all catalog routes
  app.addHook('onRequest', apiKeyAuth);

  /**
   * GET /catalog/products
   * List all products. Optional ?category=X filter.
   */
  app.get('/products', async (request: FastifyRequest<{
    Querystring: { category?: string };
  }>, reply: FastifyReply) => {
    const { category } = request.query;
    const items = await listProducts(category);

    return reply.send({
      success: true,
      data: items,
      count: items.length,
    });
  });

  /**
   * GET /catalog/products/:id
   * Get a single product by ID.
   */
  app.get('/products/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const product = await getProductById(id);

    if (!product) {
      throw new BusinessError(404, 'PRODUCT_NOT_FOUND', `Product ${id} not found`);
    }

    return reply.send({
      success: true,
      data: product,
    });
  });
}
