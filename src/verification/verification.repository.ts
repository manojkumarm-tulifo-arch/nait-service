/**
 * Data access layer — thin Prisma wrapper for all 6 verification models.
 *
 * Every database operation lives here so the service layer never touches
 * Prisma directly. This makes it straightforward to mock the entire
 * persistence layer in integration tests.
 */

import { prisma } from '../lib/prisma.js';
import type {
  VerificationSession, EmailVerification, PhoneVerification, PhotoVerification,
  IdVerification, Booking, Submission, VerificationStatus,
  VerificationStep, BookingStatus, Prisma,
} from '../generated/prisma/client.js';

export type {
  VerificationSession, EmailVerification, PhoneVerification, PhotoVerification,
  IdVerification, Booking, Submission, VerificationStatus,
  VerificationStep, BookingStatus,
};

// --- VerificationSession ---

export async function createSession(data: Prisma.VerificationSessionCreateInput) {
  return prisma.verificationSession.create({ data });
}

export async function findSessionById(id: string) {
  return prisma.verificationSession.findUnique({ where: { id } });
}

export async function findSessionByTokenJti(jti: string) {
  return prisma.verificationSession.findUnique({ where: { tokenJti: jti } });
}

export async function updateSession(id: string, data: Prisma.VerificationSessionUpdateInput) {
  return prisma.verificationSession.update({ where: { id }, data });
}

/**
 * Cursor-based pagination for session listing.
 * Fetches pageSize + 1 rows to determine if there are more results,
 * then trims to pageSize and returns the last ID as the next cursor.
 */
export async function listSessions(
  filters: { status?: VerificationStatus; employerId?: string; dateFrom?: Date; dateTo?: Date },
  cursor?: string,
  pageSize = 20,
) {
  const where: Prisma.VerificationSessionWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.employerId) where.employerId = filters.employerId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  // Fetch one extra row to detect whether more pages exist
  const sessions = await prisma.verificationSession.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: pageSize + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = sessions.length > pageSize;
  const results = hasMore ? sessions.slice(0, pageSize) : sessions;
  const nextCursor = hasMore ? results[results.length - 1].id : null;

  return { sessions: results, nextCursor, hasMore };
}

// --- EmailVerification ---

export async function createEmailVerification(data: Prisma.EmailVerificationCreateInput) {
  return prisma.emailVerification.create({ data });
}

export async function findEmailVerification(sessionId: string) {
  return prisma.emailVerification.findUnique({ where: { sessionId } });
}

export async function updateEmailVerification(sessionId: string, data: Prisma.EmailVerificationUpdateInput) {
  return prisma.emailVerification.update({ where: { sessionId }, data });
}

// --- PhoneVerification ---

export async function createPhoneVerification(data: Prisma.PhoneVerificationCreateInput) {
  return prisma.phoneVerification.create({ data });
}

export async function findPhoneVerification(sessionId: string) {
  return prisma.phoneVerification.findUnique({ where: { sessionId } });
}

export async function updatePhoneVerification(sessionId: string, data: Prisma.PhoneVerificationUpdateInput) {
  return prisma.phoneVerification.update({ where: { sessionId }, data });
}

// --- PhotoVerification ---

export async function createPhotoVerification(data: Prisma.PhotoVerificationCreateInput) {
  return prisma.photoVerification.create({ data });
}

export async function findPhotoVerification(sessionId: string) {
  return prisma.photoVerification.findUnique({ where: { sessionId } });
}

export async function updatePhotoVerification(sessionId: string, data: Prisma.PhotoVerificationUpdateInput) {
  return prisma.photoVerification.update({ where: { sessionId }, data });
}

// --- IdVerification ---

export async function createIdVerification(data: Prisma.IdVerificationCreateInput) {
  return prisma.idVerification.create({ data });
}

export async function findIdVerification(sessionId: string) {
  return prisma.idVerification.findUnique({ where: { sessionId } });
}

export async function updateIdVerification(sessionId: string, data: Prisma.IdVerificationUpdateInput) {
  return prisma.idVerification.update({ where: { sessionId }, data });
}

// --- Booking ---

export async function createBooking(data: Prisma.BookingCreateInput) {
  return prisma.booking.create({ data });
}

export async function findBookingBySessionId(sessionId: string) {
  return prisma.booking.findUnique({ where: { sessionId } });
}

export async function updateBookingStatus(id: string, status: BookingStatus, cancelReason?: string) {
  return prisma.booking.update({
    where: { id },
    data: {
      status,
      ...(status === 'cancelled' && {
        cancelledAt: new Date(),
        ...(cancelReason && { cancelReason }),
      }),
    },
  });
}

// --- Submission ---

export async function createSubmission(data: Prisma.SubmissionCreateInput) {
  return prisma.submission.create({ data });
}

export async function findSubmission(sessionId: string) {
  return prisma.submission.findUnique({ where: { sessionId } });
}

// --- Full session with all relations (admin detail view) ---

export async function findFullSession(id: string) {
  return prisma.verificationSession.findUnique({
    where: { id },
    include: {
      emailVerification: true,
      phoneVerification: true,
      photoVerification: true,
      idVerification: true,
      booking: true,
      submission: true,
    },
  });
}
