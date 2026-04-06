/**
 * Prisma client singleton using the Prisma v7 driver adapter approach.
 *
 * Instead of the default Prisma engine binary, we connect directly to
 * PostgreSQL via @prisma/adapter-pg. This reduces the container footprint
 * and avoids the engine binary download during CI/CD.
 */

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config/index.js';

const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
