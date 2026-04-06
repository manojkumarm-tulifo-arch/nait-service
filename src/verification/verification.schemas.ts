/**
 * Zod request validation schemas for all verification endpoints.
 *
 * Each schema is used with the validate() middleware factory to parse
 * and validate req.body, req.query, or req.params before the controller
 * handler runs.
 */

import { z } from 'zod';

const VERIFICATION_STATUSES = [
  'email_pending', 'email_verified', 'photo_completed', 'id_completed',
  'slot_booked', 'completed', 'cancelled', 'expired',
] as const;

// --- Admin: session creation ---

export const createSessionSchema = z.object({
  candidateName: z.string().min(1).max(200),
  candidateEmail: z.string().email(),
  candidatePhone: z.string().optional(),
  jobId: z.string().min(1),
  jobTitle: z.string().min(1).max(500),
  employerId: z.string().min(1),
  schedulingWindowStart: z.string().datetime(),
  schedulingWindowEnd: z.string().datetime(),
  slotDurationMinutes: z.number().int().positive().refine(
    (val) => [15, 30, 45, 60, 90, 120].includes(val),
    'Slot duration must be 15, 30, 45, 60, 90, or 120 minutes',
  ).optional(),
  calendarId: z.string().min(1).optional(),       // Falls back to GOOGLE_CALENDAR_ID
  linkExpiryHours: z.number().positive().optional(), // Falls back to DEFAULT_LINK_EXPIRY_HOURS
  webhookUrl: z.string().url().optional(),           // Falls back to DEFAULT_WEBHOOK_URL
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// --- Step 1: Email verification ---

export const sendOtpSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  code: z.string().length(6),
});

// --- Step 1b: Phone verification ---

export const sendPhoneOtpSchema = z.object({
  phone: z.string().min(1),
});

export const verifyPhoneOtpSchema = z.object({
  code: z.string().length(6),
});

// --- Step 2: Photo + liveness ---

export const livenessResultSchema = z.object({
  livenessScore: z.number().min(0).max(1), // 0 = no liveness, 1 = fully confident
});

// --- Step 3: ID proof ---

export const idProofConfirmSchema = z.object({
  idType: z.enum(['aadhaar', 'pan', 'passport', 'dl']),
});

// --- Step 4: Booking ---

export const bookSlotSchema = z.object({
  startTime: z.string().datetime(), // ISO 8601 — end time derived from session's slotDurationMinutes
});

// --- Step 5: Final submission ---

export const submitSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),   // Browser geolocation accuracy in metres
  deviceInfo: z.string().min(1),     // User-agent or device fingerprint string
});

// --- Admin ---

export const cancelSessionSchema = z.object({
  reason: z.string().max(1000).optional(),
});

/** Cursor-based pagination query for listing sessions. */
export const listSessionsQuerySchema = z.object({
  status: z.enum(VERIFICATION_STATUSES).optional(),
  employerId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.string().optional(),      // Session ID for cursor-based pagination
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

// --- URL param schemas ---

export const tokenParamSchema = z.object({
  token: z.string().min(1),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});
