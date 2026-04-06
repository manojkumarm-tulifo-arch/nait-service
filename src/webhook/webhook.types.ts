/**
 * Webhook event types fired during the verification lifecycle:
 *   - invitation_sent:    session created or invitation resent
 *   - booking_confirmed:  candidate completed all steps and submitted
 *   - booking_cancelled:  admin cancelled the session
 */
export type WebhookEventType = 'invitation_sent' | 'booking_confirmed' | 'booking_cancelled';

/** HTTP POST body delivered to the configured webhook URL. */
export interface WebhookPayload {
  eventType: WebhookEventType;
  timestamp: string;              // ISO 8601
  sessionId: string;
  data: Record<string, unknown>;  // Event-specific fields
}
