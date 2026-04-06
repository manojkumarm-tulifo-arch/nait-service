/**
 * API key authentication middleware for admin endpoints.
 *
 * Validates the `x-api-key` header against the configured API_KEY.
 * Uses constant-time comparison (crypto.timingSafeEqual) to prevent
 * timing side-channel attacks that could leak the key length or value.
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../lib/errors.js';

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    throw new UnauthorizedError('Missing API key');
  }

  // Length check first — timingSafeEqual requires equal-length buffers
  const expected = Buffer.from(config.API_KEY);
  const provided = Buffer.from(apiKey);

  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw new UnauthorizedError('Invalid API key');
  }

  next();
}
