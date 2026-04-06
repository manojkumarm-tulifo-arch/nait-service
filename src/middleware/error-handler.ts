/**
 * Global Express error handler.
 *
 * Catches every error thrown or passed via next(err) and maps it to
 * the standard JSON error envelope. Order of checks:
 *   1. AppError subclasses — use their built-in status/code
 *   2. Prisma known errors — translate DB-level codes to HTTP semantics
 *   3. Everything else — 500 with a generic message in production
 *
 * Must be registered *after* all route handlers (Express identifies
 * error handlers by the 4-argument signature).
 */

import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { sendError } from '../lib/response.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Domain errors — already carry HTTP status and code
  if (err instanceof AppError) {
    logger.warn({ err, code: err.code }, err.message);
    sendError(res, err.statusCode, err.code, err.message);
    return;
  }

  // Prisma known request errors — map DB error codes to HTTP semantics
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') { // Unique constraint violation
      logger.warn({ err }, 'Unique constraint violation');
      sendError(res, 409, 'CONFLICT', 'Resource already exists');
      return;
    }
    if (err.code === 'P2025') { // Record not found (e.g. update on missing row)
      logger.warn({ err }, 'Record not found');
      sendError(res, 404, 'NOT_FOUND', 'Resource not found');
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn({ err }, 'Prisma validation error');
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid data');
    return;
  }

  // Fallback — hide internal details in production
  logger.error({ err }, 'Unhandled error');
  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  );
}
