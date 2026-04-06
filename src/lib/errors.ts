/**
 * Typed application error hierarchy.
 *
 * All custom errors extend AppError, which carries an HTTP status code and
 * a machine-readable error code. The global error handler (middleware/error-handler.ts)
 * catches any thrown AppError and maps it to the standard JSON envelope:
 *   { error: { code, message } }
 *
 * This avoids scattering HTTP status logic across controllers — throw the
 * right error subclass and the handler does the rest.
 */

/** Base error — all domain errors extend this. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** 400 — Invalid request body, params, or query. */
export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown[]) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

/** 404 — Requested entity does not exist. */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

/** 401 — Missing or invalid API key. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/** 409 — Operation conflicts with current state (e.g. duplicate booking). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

/** 502 — Google Calendar API failure. */
export class CalendarError extends AppError {
  constructor(message: string) {
    super(502, 'CALENDAR_ERROR', message);
  }
}

/** 502 — Webhook delivery failure. */
export class WebhookError extends AppError {
  constructor(message: string) {
    super(502, 'WEBHOOK_ERROR', message);
  }
}

/** 401 — JWT verification link is expired or tampered with. */
export class TokenError extends AppError {
  constructor(code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID', message: string) {
    super(401, code, message);
  }
}
