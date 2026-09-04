import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { testConnection } from './db/index.js';
import { pushSchema } from './db/migrate.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { catalogRoutes } from './services/catalog/catalog.routes.js';
import { mandateRoutes } from './services/mandate/mandate.routes.js';
import { auditRoutes } from './services/audit/audit.routes.js';
import { gatewayRoutes } from './services/gateway/gateway.routes.js';
import { agentRoutes } from './services/agent/agent.routes.js';

export async function buildServer() {
  const app = Fastify({
    logger: false, // We use our own pino logger
    requestTimeout: 30_000,
  });

  // ─── Plugins ──────────────────────────────────────────────────────
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'x-idempotency-key'],
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => {
      return (request.headers['x-api-key'] as string) || request.ip;
    },
  });

  // ─── Error Handler ────────────────────────────────────────────────
  registerErrorHandler(app);

  // ─── Health Check ─────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // ─── Service Routes ───────────────────────────────────────────────
  await app.register(catalogRoutes, { prefix: '/api/catalog' });
  await app.register(mandateRoutes, { prefix: '/api/mandates' });
  await app.register(auditRoutes, { prefix: '/api/audit' });
  await app.register(gatewayRoutes, { prefix: '/api/gateway' });
  await app.register(agentRoutes, { prefix: '/api/agent' });

  return app;
}

async function main() {
  try {
    // Test database connection
    await testConnection();

    // Push schema (development mode — idempotent)
    await pushSchema();

    // Build and start server
    const app = await buildServer();

    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`🚀 Agentic Commerce server running on http://localhost:${config.PORT}`);
    logger.info(`   Environment: ${config.NODE_ENV}`);
    logger.info(`   Health check: http://localhost:${config.PORT}/health`);
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
