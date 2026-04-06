/**
 * NAIT Service — Entry point.
 *
 * Boots the application: connects to PostgreSQL, starts the HTTP server,
 * and registers signal handlers for graceful shutdown (drain connections
 * before exiting so in-flight requests complete cleanly).
 */

import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  // Eagerly verify DB connectivity so the process fails fast on bad credentials
  logger.info('Connecting to PostgreSQL');
  await prisma.$connect();
  logger.info('Connected to PostgreSQL');

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'NAIT service started');
  });

  // Graceful shutdown: stop accepting new connections, then close the DB pool
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    server.close(() => {
      logger.info('HTTP server closed');
    });

    await prisma.$disconnect();
    logger.info('PostgreSQL connection closed');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start nait service');
  process.exit(1);
});
