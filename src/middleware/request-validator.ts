/**
 * Zod request validation middleware factory.
 *
 * Usage: validate(mySchema, 'body') — returns an Express middleware that
 * parses req[source] through the schema and throws ValidationError on
 * failure.
 *
 * Express 5 note: req.query and req.params are read-only getters in
 * Express 5, so validated data is stored on req.validated_query /
 * req.validated_params instead of overwriting the originals.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors.js';

type RequestSource = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: RequestSource) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new ValidationError('Request validation failed', details);
    }

    if (source === 'body') {
      req.body = result.data;
    } else {
      // Stash validated query/params on a custom property since Express 5 freezes the originals
      (req as unknown as Record<string, unknown>)[`validated_${source}`] = result.data;
    }
    next();
  };
}
