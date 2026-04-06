/**
 * Pino structured logger.
 *
 * Outputs JSON in production (machine-parseable for log aggregation).
 * In development, uses the pino/file transport writing to stdout for
 * human-readable output in the terminal.
 */

import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  name: 'nait-service',
  ...(config.NODE_ENV === 'development' && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
});
