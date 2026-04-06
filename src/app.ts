/**
 * Express application factory.
 *
 * Exports createApp() which builds the Express app without calling .listen(),
 * so integration tests can use supertest against the same app instance
 * without starting an actual HTTP server.
 */

import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttpRaw from 'pino-http';
const pinoHttp = pinoHttpRaw as any;
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './health/health.routes.js';
import { verificationRouter } from './verification/verification.routes.js';

export function createApp(): express.Express {
  const app = express();

  // --- Global middleware ---
  app.use(helmet());          // Security headers (CSP, HSTS, etc.)
  app.use(cors());            // Cross-origin requests (frontend on different port in dev)
  app.use(express.json());    // Parse JSON request bodies
  app.use(pinoHttp({ logger })); // Structured request/response logging

  // --- Routes ---
  app.use(healthRouter);                  // /health, /health/ready — no auth
  app.use('/api/v1', verificationRouter); // All verification + admin endpoints

  // Global error handler — must be registered after all routes
  app.use(errorHandler);

  // In production, serve the React SPA from client/dist with history-mode fallback
  const clientDist = path.resolve(process.cwd(), 'client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return app;
}
