/**
 * Validated environment configuration.
 *
 * Uses Zod to parse and validate process.env at startup. If any required
 * variable is missing or malformed the process exits immediately with a
 * descriptive error — fail fast rather than crash later with a cryptic
 * runtime error.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1),

  // Auth
  API_KEY: z.string().min(1),                     // Shared secret for admin endpoints (x-api-key header)
  JWT_SECRET: z.string().min(32),                  // Minimum 32 chars to ensure adequate entropy
  JWT_ISSUER: z.string().default('tulifo-video-nait'),
  VERIFICATION_BASE_URL: z.string().url(),         // Base URL prepended to JWT tokens for verification links

  // Google Calendar — supports two auth modes:
  //   "service-account": requires GOOGLE_SERVICE_ACCOUNT_KEY_PATH
  //   "oauth": requires CLIENT_ID + CLIENT_SECRET + REFRESH_TOKEN
  GOOGLE_AUTH_MODE: z.enum(['service-account', 'oauth']).default('service-account'),
  GOOGLE_SERVICE_ACCOUNT_KEY_PATH: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),

  // Cloudinary — cloud image storage for photos and ID proofs
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Defaults applied when admin doesn't specify per-session overrides
  DEFAULT_WEBHOOK_URL: z.string().url(),
  DEFAULT_LINK_EXPIRY_HOURS: z.coerce.number().positive().default(72),
  DEFAULT_SLOT_DURATION_MINUTES: z.coerce.number().positive().default(60),
});

export type Config = z.infer<typeof configSchema>;

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config: Config = parsed.data;
