import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export interface AppError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export class BusinessError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'BusinessError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    // Business errors (expected rejections)
    if (error instanceof BusinessError) {
      logger.warn(
        { code: error.code, path: request.url, method: request.method },
        error.message
      );

      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      logger.warn(
        { path: request.url, issues: error.issues },
        'Validation error'
      );

      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }

    // Fastify validation errors (from JSON schema)
    if ('validation' in error && Array.isArray((error as any).validation)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: (error as any).validation,
        },
      });
    }

    // Unexpected errors — log fully, return generic message
    logger.error(
      { err: error, path: request.url, method: request.method },
      'Unhandled error'
    );

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
}
