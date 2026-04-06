/**
 * JSON response envelope helpers.
 *
 * Every API response follows a consistent shape:
 *   Success: { data: { ... }, meta?: { ... } }
 *   Error:   { error: { code, message, details? } }
 *
 * Controllers call sendSuccess(); the error handler calls sendError().
 * This keeps serialisation logic in one place and ensures clients can
 * rely on a predictable top-level structure.
 */

import type { Response } from 'express';

/** Pagination metadata for list endpoints. */
interface SuccessMeta {
  nextCursor?: string | null;
  hasMore?: boolean;
  pageSize?: number;
}

export function sendSuccess(res: Response, data: unknown, statusCode = 200, meta?: SuccessMeta): void {
  const body: Record<string, unknown> = { data };
  if (meta) {
    body.meta = meta;
  }
  res.status(statusCode).json(body);
}

export function sendError(res: Response, statusCode: number, code: string, message: string, details?: unknown[]): void {
  const body: Record<string, unknown> = {
    error: { code, message },
  };
  if (details) {
    (body.error as Record<string, unknown>).details = details;
  }
  res.status(statusCode).json(body);
}
