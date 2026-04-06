/**
 * Webhook dispatch service — fire-and-forget HTTP callbacks.
 *
 * Webhooks are dispatched asynchronously so they never block the primary
 * request/response flow. On failure, dispatch retries up to MAX_RETRIES
 * times with exponential backoff (1s, 2s). If all attempts fail, the
 * error is logged but not propagated — webhook delivery is best-effort.
 */

import axios from 'axios';
import { logger } from '../lib/logger.js';
import type { WebhookPayload } from './webhook.types.js';

const MAX_RETRIES = 2;        // Total attempts: 1 initial + 2 retries = 3
const TIMEOUT_MS = 5000;      // Per-request timeout
const BACKOFF_BASE_MS = 1000; // Backoff: 1s, 2s (doubles each retry)

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Attempt to deliver the webhook payload with retries. */
export async function dispatch(url: string, payload: WebhookPayload): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        timeout: TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      });

      logger.info(
        { eventType: payload.eventType, url, status: response.status, attempt },
        'Webhook dispatched successfully',
      );
      return;
    } catch (err) {
      const isLastAttempt = attempt === MAX_RETRIES;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      if (isLastAttempt) {
        logger.error(
          { eventType: payload.eventType, url, attempt, error: errorMessage },
          'Webhook dispatch failed after all retries',
        );
        return; // Swallow — webhook failure must not affect the caller
      }

      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
      logger.warn(
        { eventType: payload.eventType, url, attempt, error: errorMessage, retryInMs: backoffMs },
        'Webhook dispatch failed, retrying',
      );
      await sleep(backoffMs);
    }
  }
}

/**
 * Dispatch a webhook without awaiting the result.
 * The returned promise is intentionally not awaited by callers —
 * errors are caught and logged internally.
 */
export function fireAndForget(url: string, payload: WebhookPayload): void {
  dispatch(url, payload).catch((err) => {
    logger.error({ err, url, eventType: payload.eventType }, 'Unexpected error in webhook fire-and-forget');
  });
}
