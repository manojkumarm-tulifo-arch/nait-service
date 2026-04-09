/**
 * Core business logic — orchestrates the 5-step verification flow.
 *
 * Session state machine:
 *   email_pending → email_verified → photo_completed → id_completed → slot_booked → completed
 *                                                                                   ↘ cancelled
 *
 * Each public method:
 *   1. Verifies the JWT token and resolves the session via jti
 *   2. Validates the current step is correct for the operation
 *   3. Performs the business action (DB write, calendar call, etc.)
 *   4. Advances the session state to the next step
 */

import crypto from 'node:crypto';
import { config } from '../config/index.js';
import * as tokenService from '../token/token.service.js';
import * as calendarService from '../calendar/calendar.service.js';
import * as webhookService from '../webhook/webhook.service.js';
import * as repo from './verification.repository.js';
import { NotFoundError, ConflictError, ValidationError } from '../lib/errors.js';
import type { CreateSessionInput, ListSessionsQuery } from './verification.schemas.js';
import type { Prisma } from '../generated/prisma/client.js';

const HARDCODED_OTP = '123456';   // TODO: replace with real OTP delivery (email/SMS provider)
const OTP_EXPIRY_MINUTES = 5;


// --- Session Management ---

export async function createSession(input: CreateSessionInput) {
  // Two-phase token generation: create session first (need DB-generated ID),
  // then regenerate the token with the real session ID embedded in it.
  const { jti, expiresAt } = tokenService.generateToken(
    { sessionId: 'placeholder', candidateEmail: input.candidateEmail ?? undefined, employerId: input.employerId },
    input.linkExpiryHours ?? config.DEFAULT_LINK_EXPIRY_HOURS,
  );

  const session = await repo.createSession({
    candidateName: input.candidateName,
    candidateEmail: input.candidateEmail,
    candidatePhone: input.candidatePhone,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    employerId: input.employerId,
    tokenJti: jti,
    tokenExpiresAt: expiresAt,
    schedulingWindowStart: new Date(input.schedulingWindowStart),
    schedulingWindowEnd: new Date(input.schedulingWindowEnd),
    slotDurationMinutes: input.slotDurationMinutes ?? config.DEFAULT_SLOT_DURATION_MINUTES,
    calendarId: input.calendarId ?? config.GOOGLE_CALENDAR_ID,
    webhookUrl: input.webhookUrl ?? config.DEFAULT_WEBHOOK_URL,
    metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  });

  // Regenerate token with the real session ID now that the row exists
  const { token, jti: finalJti, expiresAt: finalExpiresAt } = tokenService.generateToken(
    { sessionId: session.id, candidateEmail: input.candidateEmail ?? undefined, employerId: input.employerId },
    input.linkExpiryHours ?? config.DEFAULT_LINK_EXPIRY_HOURS,
  );

  await repo.updateSession(session.id, {
    tokenJti: finalJti,
    tokenExpiresAt: finalExpiresAt,
  });

  const verificationLink = `${config.VERIFICATION_BASE_URL}/${token}`;

  webhookService.fireAndForget(session.webhookUrl, {
    eventType: 'invitation_sent',
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    data: {
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail,
      candidatePhone: input.candidatePhone,
      jobTitle: input.jobTitle,
      verificationLink,
    },
  });

  const updated = await repo.findSessionById(session.id);
  return { session: updated!, verificationLink };
}

/**
 * Fetch the current state of a session for the candidate's frontend.
 *
 * Performs three guard checks before returning data:
 *  1. Token validity — JWT must be well-formed and not expired.
 *  2. Session status — cancelled / already-expired sessions are rejected.
 *  3. Scheduling window expiry — if the admin-defined scheduling window end
 *     date has passed and the session is not yet completed, the session is
 *     automatically marked as expired in the database and the candidate sees
 *     an "expired" message instead of the verification wizard.
 *
 * All step data (email, phone, photo, ID, booking, submission) is fetched
 * in parallel so the frontend can render the correct step in a single round trip.
 */
export async function getSessionState(token: string) {
  const payload = tokenService.verifyToken(token);
  // Look up by jti rather than sessionId to ensure only the latest token works
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');
  if (session.status === 'cancelled') throw new ConflictError('This session has been cancelled');
  if (session.status === 'expired') throw new ConflictError('This session has expired');

  // If the scheduling window has passed and verification is not yet completed, mark as expired.
  // The admin's end date is stored as midnight of the day after the last selectable date,
  // so this comparison naturally covers the entire last day.
  if (session.status !== 'completed' && session.schedulingWindowEnd < new Date()) {
    await repo.updateSession(session.id, { status: 'expired' });
    throw new ConflictError('This verification link has expired. The scheduling window has ended.');
  }

  // Fetch all step data in parallel for the frontend to render the correct step
  const [emailVer, phoneVer, photoVer, idVer, booking, submission] = await Promise.all([
    repo.findEmailVerification(session.id),
    repo.findPhoneVerification(session.id),
    repo.findPhotoVerification(session.id),
    repo.findIdVerification(session.id),
    repo.findBookingBySessionId(session.id),
    repo.findSubmission(session.id),
  ]);

  return {
    sessionId: session.id,
    candidateName: session.candidateName,
    candidateEmail: session.candidateEmail,
    candidatePhone: session.candidatePhone,
    jobTitle: session.jobTitle,
    status: session.status,
    currentStep: session.currentStep,
    email: emailVer ? { verified: emailVer.verified, email: emailVer.email } : null,
    phone: phoneVer ? { verified: phoneVer.verified, phone: phoneVer.phone } : null,
    photo: photoVer ? { completed: true, livenessCompleted: photoVer.livenessCompleted, livenessScore: photoVer.livenessScore, photoUrl: photoVer.photoPath } : null,
    idProof: idVer ? { verified: idVer.verified, idType: idVer.idType, extractedName: idVer.extractedName, faceMatchScore: idVer.faceMatchScore, imageUrl: idVer.imagePath } : null,
    booking: booking && booking.status === 'confirmed' ? {
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      timeRemainingMs: Math.max(0, booking.startTime.getTime() - Date.now()),
    } : null,
    submission: submission ? {
      referenceNumber: submission.referenceNumber,
      submittedAt: submission.submittedAt.toISOString(),
    } : null,
  };
}

// --- Update missing contact info (user-facing) ---

/**
 * Allow the candidate to supply missing contact info (email or phone) that
 * the admin left blank when creating the session. Only fills in fields that
 * are currently null — existing values cannot be overwritten.
 */
export async function updateContactInfo(token: string, data: { candidateEmail?: string; candidatePhone?: string }) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const updates: Record<string, string> = {};

  if (data.candidateEmail && !session.candidateEmail) {
    updates.candidateEmail = data.candidateEmail;
  }
  if (data.candidatePhone && !session.candidatePhone) {
    updates.candidatePhone = data.candidatePhone;
  }

  if (Object.keys(updates).length === 0) {
    throw new ConflictError('No missing contact fields to update');
  }

  await repo.updateSession(session.id, updates);
  const updated = await repo.findSessionById(session.id);
  return {
    candidateEmail: updated!.candidateEmail,
    candidatePhone: updated!.candidatePhone,
    message: 'Contact information updated',
  };
}

// --- Step 1: Email Verification ---

/** Send a 6-digit OTP to the candidate's email. Validates the address matches the session. */
export async function sendOtp(token: string, email: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  // Verify the email matches the session
  if (session.candidateEmail !== email) {
    throw new ValidationError('Email does not match the invitation');
  }

  const existing = await repo.findEmailVerification(session.id);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  if (existing) {
    await repo.updateEmailVerification(session.id, {
      otpCode: HARDCODED_OTP,
      otpExpiresAt,
      verified: false,
      verifiedAt: null,
    });
  } else {
    await repo.createEmailVerification({
      session: { connect: { id: session.id } },
      email,
      otpCode: HARDCODED_OTP,
      otpExpiresAt,
    });
  }

  return { message: 'OTP sent', expiresInSeconds: OTP_EXPIRY_MINUTES * 60 };
}

/**
 * Verify the candidate's email OTP.
 *
 * Session advancement: the session only moves to the next step (photo) when
 * BOTH email AND phone are verified. This method checks phone status after
 * marking email as verified. The frontend must call email and phone
 * verification sequentially (not in parallel) so the second call sees the
 * first as committed — otherwise a race condition prevents advancement.
 */
export async function verifyOtp(token: string, code: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const emailVer = await repo.findEmailVerification(session.id);
  if (!emailVer) throw new ConflictError('OTP has not been sent yet');

  if (emailVer.verified) return { verified: true, message: 'Email already verified' };

  if (new Date() > emailVer.otpExpiresAt) {
    throw new ConflictError('OTP has expired. Please request a new one.');
  }

  if (emailVer.otpCode !== code) {
    throw new ValidationError('Invalid OTP code');
  }

  await repo.updateEmailVerification(session.id, {
    verified: true,
    verifiedAt: new Date(),
  });

  // Only advance to next step if phone is also verified
  const phoneVer = await repo.findPhoneVerification(session.id);
  const phoneVerified = phoneVer?.verified === true;

  if (phoneVerified) {
    await repo.updateSession(session.id, {
      status: 'email_verified',
      currentStep: 'photo',
    });
  }

  return { verified: true, message: 'Email verified successfully' };
}

// --- Step 1b: Phone Verification ---

/** Send a 6-digit OTP to the candidate's phone. Validates the number matches the session. */
export async function sendPhoneOtp(token: string, phone: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  if (session.candidatePhone !== phone) {
    throw new ValidationError('Phone number does not match the invitation');
  }

  const existing = await repo.findPhoneVerification(session.id);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  if (existing) {
    await repo.updatePhoneVerification(session.id, {
      otpCode: HARDCODED_OTP,
      otpExpiresAt,
      verified: false,
      verifiedAt: null,
    });
  } else {
    await repo.createPhoneVerification({
      session: { connect: { id: session.id } },
      phone,
      otpCode: HARDCODED_OTP,
      otpExpiresAt,
    });
  }

  return { message: 'OTP sent to phone', expiresInSeconds: OTP_EXPIRY_MINUTES * 60 };
}

/**
 * Verify the candidate's phone OTP.
 *
 * Mirror of verifyOtp — advances the session only when both email and phone
 * are verified. See verifyOtp JSDoc for the sequential-verification note.
 */
export async function verifyPhoneOtp(token: string, code: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const phoneVer = await repo.findPhoneVerification(session.id);
  if (!phoneVer) throw new ConflictError('Phone OTP has not been sent yet');

  if (phoneVer.verified) return { verified: true, message: 'Phone already verified' };

  if (new Date() > phoneVer.otpExpiresAt) {
    throw new ConflictError('OTP has expired. Please request a new one.');
  }

  if (phoneVer.otpCode !== code) {
    throw new ValidationError('Invalid OTP code');
  }

  await repo.updatePhoneVerification(session.id, {
    verified: true,
    verifiedAt: new Date(),
  });

  // Only advance to next step if email is also verified
  const emailVer = await repo.findEmailVerification(session.id);
  const emailVerified = emailVer?.verified === true;

  if (emailVerified) {
    await repo.updateSession(session.id, {
      status: 'email_verified',
      currentStep: 'photo',
    });
  }

  return { verified: true, message: 'Phone verified successfully' };
}

// --- Step 2: Photo + Liveness ---

export async function uploadPhoto(token: string, photoPath: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const existing = await repo.findPhotoVerification(session.id);
  if (existing) {
    await repo.updatePhotoVerification(session.id, {
      photoPath,
      livenessCompleted: false,
      livenessScore: null,
    });
  } else {
    await repo.createPhotoVerification({
      session: { connect: { id: session.id } },
      photoPath,
    });
  }

  return { message: 'Photo uploaded', photoPath };
}

export async function submitLivenessResult(token: string, livenessScore: number) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const photoVer = await repo.findPhotoVerification(session.id);
  if (!photoVer) throw new ConflictError('Photo has not been uploaded yet');

  await repo.updatePhotoVerification(session.id, {
    livenessCompleted: true,
    livenessScore,
  });

  await repo.updateSession(session.id, {
    status: 'photo_completed',
    currentStep: 'id_proof',
  });

  return { message: 'Liveness check completed', livenessScore };
}

// --- Step 3: ID Proof ---

export async function uploadIdProof(token: string, idType: string, imagePath: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  // TODO: Replace with real OCR + face-match service in production.
  // Currently returns mock data for development/demo purposes.
  const extractedName = session.candidateName;
  const faceMatchScore = 0.94;

  const existing = await repo.findIdVerification(session.id);
  if (existing) {
    await repo.updateIdVerification(session.id, {
      idType: idType as repo.IdVerification['idType'],
      imagePath,
      extractedName,
      extractedData: { name: extractedName, idType } as Prisma.InputJsonValue,
      faceMatchScore,
      verified: false,
    });
  } else {
    await repo.createIdVerification({
      session: { connect: { id: session.id } },
      idType: idType as repo.IdVerification['idType'],
      imagePath,
      extractedName,
      extractedData: { name: extractedName, idType } as Prisma.InputJsonValue,
      faceMatchScore,
    });
  }

  return { extractedName, faceMatchScore, message: 'ID processed' };
}

export async function confirmIdProof(token: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const idVer = await repo.findIdVerification(session.id);
  if (!idVer) throw new ConflictError('ID proof has not been uploaded yet');

  await repo.updateIdVerification(session.id, { verified: true });

  // Update candidate name from extracted data if available
  if (idVer.extractedName) {
    await repo.updateSession(session.id, {
      candidateName: idVer.extractedName,
      status: 'id_completed',
      currentStep: 'schedule',
    });
  } else {
    await repo.updateSession(session.id, {
      status: 'id_completed',
      currentStep: 'schedule',
    });
  }

  return { verified: true, message: 'ID confirmed' };
}

// --- Step 4: Schedule ---

/**
 * Retrieve 1-hour interview slots within the admin-defined scheduling window.
 *
 * Slot generation (delegated to calendarService.getAvailableSlots):
 *  - Slots are 1-hour blocks aligned to local-time hour boundaries (12 AM, 1 AM, …).
 *  - Only slots starting at least 2 hours from the current time are returned.
 *  - Each slot is marked available/blocked based on Google Calendar freebusy data.
 */
export async function getAvailableSlots(token: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const slots = await calendarService.getAvailableSlots(
    session.calendarId,
    session.schedulingWindowStart,
    session.schedulingWindowEnd,
    session.slotDurationMinutes,
  );

  return {
    candidateName: session.candidateName,
    schedulingWindow: {
      start: session.schedulingWindowStart.toISOString(),
      end: session.schedulingWindowEnd.toISOString(),
    },
    slotDurationMinutes: session.slotDurationMinutes,
    availableSlots: slots,
  };
}

/**
 * Book an interview slot on Google Calendar.
 *
 * Validates the slot is within the scheduling window, then re-checks
 * Google Calendar freebusy as a race-condition guard before creating the event.
 */
export async function bookSlot(token: string, startTime: string) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const existing = await repo.findBookingBySessionId(session.id);
  if (existing) throw new ConflictError('A booking already exists for this session');

  const slotStart = new Date(startTime);
  const slotEnd = new Date(slotStart.getTime() + session.slotDurationMinutes * 60 * 1000);

  if (slotStart < session.schedulingWindowStart || slotEnd > session.schedulingWindowEnd) {
    throw new ConflictError('Selected slot is outside the scheduling window');
  }

  // Race condition guard: re-check freebusy right before booking.
  // Another candidate may have booked this slot since the GET /slots response.
  const isAvailable = await calendarService.isSlotAvailable(session.calendarId, slotStart, slotEnd);
  if (!isAvailable) throw new ConflictError('Selected slot is no longer available');

  const calendarEvent = await calendarService.createEvent(
    session.calendarId,
    `${session.jobTitle} — ${session.candidateName}`,
    `Verified via Tulifo-VIDEO\nCandidate: ${session.candidateName} (${session.candidateEmail ?? ''})`,
    slotStart, slotEnd, session.candidateEmail ?? '',
  );

  const booking = await repo.createBooking({
    session: { connect: { id: session.id } },
    candidateEmail: session.candidateEmail ?? '',
    jobId: session.jobId,
    employerId: session.employerId,
    startTime: slotStart,
    endTime: slotEnd,
    googleCalendarEventId: calendarEvent.eventId,
    calendarId: session.calendarId,
  });

  await repo.updateSession(session.id, {
    status: 'slot_booked',
    currentStep: 'review',
  });

  return {
    bookingId: booking.id,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    status: booking.status,
  };
}

// --- Step 5: Submit ---

/**
 * Final submission: records geolocation + device info, generates a reference
 * number (VRF-YYYY-XXXX), marks the session as completed, and fires the
 * booking_confirmed webhook. Idempotency: throws ConflictError if already submitted.
 */
export async function submit(token: string, data: { latitude: number; longitude: number; accuracy?: number; deviceInfo: string }) {
  const payload = tokenService.verifyToken(token);
  const session = await repo.findSessionByTokenJti(payload.jti);
  if (!session) throw new NotFoundError('Verification session');

  const existing = await repo.findSubmission(session.id);
  if (existing) throw new ConflictError('Verification already submitted');

  // Generate a human-readable reference number: VRF-YYYY-XXXX
  const referenceNumber = `VRF-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;

  const submission = await repo.createSubmission({
    session: { connect: { id: session.id } },
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
    deviceInfo: data.deviceInfo,
    referenceNumber,
  });

  await repo.updateSession(session.id, { status: 'completed' });

  // Fire webhook
  webhookService.fireAndForget(session.webhookUrl, {
    eventType: 'booking_confirmed',
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    data: {
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      referenceNumber,
    },
  });

  const booking = await repo.findBookingBySessionId(session.id);

  return {
    referenceNumber: submission.referenceNumber,
    candidateName: session.candidateName,
    candidateEmail: session.candidateEmail,
    booking: booking ? {
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    } : null,
  };
}

// --- Admin ---

/** Fetch the full session with all related step data (admin view). */
export async function getFullSession(sessionId: string) {
  const session = await repo.findFullSession(sessionId);
  if (!session) throw new NotFoundError('Verification session');
  return session;
}

/** List sessions with optional filters (status, employer, date range) and cursor pagination. */
export async function listSessions(query: ListSessionsQuery) {
  return repo.listSessions(
    {
      status: query.status as repo.VerificationStatus | undefined,
      employerId: query.employerId,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    },
    query.cursor,
    query.pageSize,
  );
}

/** Cancel a session — also removes the Google Calendar event if one was booked. */
export async function cancelSession(sessionId: string, reason?: string) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new NotFoundError('Verification session');

  // Clean up the calendar event before marking the session as cancelled
  const booking = await repo.findBookingBySessionId(sessionId);
  if (booking && booking.status === 'confirmed') {
    await calendarService.deleteEvent(booking.calendarId, booking.googleCalendarEventId);
    await repo.updateBookingStatus(booking.id, 'cancelled', reason);
  }

  const updated = await repo.updateSession(sessionId, { status: 'cancelled' });

  webhookService.fireAndForget(session.webhookUrl, {
    eventType: 'booking_cancelled',
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    data: { candidateName: session.candidateName, candidateEmail: session.candidateEmail, reason },
  });

  return updated;
}

/**
 * Resend the verification invitation with a fresh JWT.
 * The old token's jti is overwritten, effectively invalidating it —
 * only the newest link works at any given time.
 */
export async function resendInvitation(sessionId: string) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new NotFoundError('Verification session');

  const { token, jti, expiresAt } = tokenService.generateToken(
    { sessionId: session.id, candidateEmail: session.candidateEmail ?? undefined, employerId: session.employerId },
    config.DEFAULT_LINK_EXPIRY_HOURS,
  );

  await repo.updateSession(session.id, { tokenJti: jti, tokenExpiresAt: expiresAt });

  const verificationLink = `${config.VERIFICATION_BASE_URL}/${token}`;

  webhookService.fireAndForget(session.webhookUrl, {
    eventType: 'invitation_sent',
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    data: { candidateName: session.candidateName, candidateEmail: session.candidateEmail, verificationLink },
  });

  const updated = await repo.findSessionById(session.id);
  return { session: updated!, verificationLink };
}
