/**
 * Health check controllers.
 *
 * /health       — liveness probe: always 200 if the process is running.
 * /health/ready — readiness probe: 200 only when PostgreSQL is reachable.
 *                 Returns 503 "degraded" otherwise so load balancers can
 *                 stop routing traffic until the DB recovers.
 */

import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const startTime = Date.now();

/** Liveness — process is alive. */
export function liveness(_req: Request, res: Response): void {
  res.json({ status: 'ok' });
}

/** Readiness — process is alive AND downstream dependencies are healthy. */
export async function readiness(_req: Request, res: Response): Promise<void> {
  let pgOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    pgOk = true;
  } catch {
    // DB connection failed — report degraded
  }

  const checks = {
    postgresql: pgOk ? 'ok' : 'unavailable',
  };

  res.status(pgOk ? 200 : 503).json({
    status: pgOk ? 'ready' : 'degraded',
    checks,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  });
}
