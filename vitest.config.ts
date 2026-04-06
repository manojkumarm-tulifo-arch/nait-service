import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: 'src',
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    env: {
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/nait_test',
      API_KEY: 'test-api-key',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
      JWT_ISSUER: 'tulifo-video-nait-test',
      VERIFICATION_BASE_URL: 'http://localhost:3000/verify',
      GOOGLE_AUTH_MODE: 'service-account',
      GOOGLE_SERVICE_ACCOUNT_KEY_PATH: './test-service-account.json',
      GOOGLE_CALENDAR_ID: 'test-calendar@group.calendar.google.com',
      DEFAULT_WEBHOOK_URL: 'http://localhost:9999/webhook',
      DEFAULT_LINK_EXPIRY_HOURS: '72',
      DEFAULT_SLOT_DURATION_MINUTES: '30',
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
    },
  },
});
