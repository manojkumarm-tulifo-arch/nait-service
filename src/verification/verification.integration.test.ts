import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import * as repo from './verification.repository.js';
import * as calendarService from '../calendar/calendar.service.js';
import * as webhookService from '../webhook/webhook.service.js';
import { generateToken } from '../token/token.service.js';

vi.mock('./verification.repository.js');
vi.mock('../calendar/calendar.service.js');
vi.mock('../webhook/webhook.service.js');

const API_KEY = 'test-api-key';
const app = createApp();

// Helper: create a mock session object
function mockSession(overrides: Partial<repo.VerificationSession> = {}): repo.VerificationSession {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    candidateName: 'Rajesh Kumar',
    candidateEmail: 'rajesh@example.com',
    candidatePhone: null,
    jobId: 'job-001',
    jobTitle: 'Software Engineer',
    employerId: 'employer-001',
    status: 'email_pending' as repo.VerificationStatus,
    currentStep: 'email' as repo.VerificationStep,
    tokenJti: 'test-jti',
    tokenExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    schedulingWindowStart: new Date('2026-04-07T09:00:00Z'),
    schedulingWindowEnd: new Date('2026-04-14T17:00:00Z'),
    slotDurationMinutes: 30,
    calendarId: 'cal@group.calendar.google.com',
    webhookUrl: 'http://localhost:9999/webhook',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper: generate a valid token for a session
function tokenForSession(session: repo.VerificationSession) {
  const { token, jti } = generateToken(
    { sessionId: session.id, candidateEmail: session.candidateEmail, employerId: session.employerId },
    72,
  );
  return { token, jti };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(webhookService.fireAndForget).mockImplementation(() => {});
});

// ─── Admin: Create Session ────────────────────────────────────────────

describe('POST /api/v1/sessions (admin)', () => {
  it('should create a verification session', async () => {
    const session = mockSession();
    vi.mocked(repo.createSession).mockResolvedValue(session);
    vi.mocked(repo.updateSession).mockResolvedValue(session);
    vi.mocked(repo.findSessionById).mockResolvedValue(session);

    const res = await request(app)
      .post('/api/v1/sessions')
      .set('x-api-key', API_KEY)
      .send({
        candidateName: 'Rajesh Kumar',
        candidateEmail: 'rajesh@example.com',
        jobId: 'job-001',
        jobTitle: 'Software Engineer',
        employerId: 'employer-001',
        schedulingWindowStart: '2026-04-07T09:00:00Z',
        schedulingWindowEnd: '2026-04-14T17:00:00Z',
        slotDurationMinutes: 30,
        calendarId: 'cal@group.calendar.google.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sessionId).toBe(session.id);
    expect(res.body.data.verificationLink).toContain('http://localhost:3000/verify/');
    expect(res.body.data.status).toBe('email_pending');
    expect(repo.createSession).toHaveBeenCalledTimes(1);
    expect(webhookService.fireAndForget).toHaveBeenCalledTimes(1);
  });

  it('should reject without API key', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .send({ candidateName: 'Test' });

    expect(res.status).toBe(401);
  });

  it('should reject invalid payload', async () => {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('x-api-key', API_KEY)
      .send({ candidateName: 'Test' });

    expect(res.status).toBe(400);
  });
});

// ─── Public: Get Session State ────────────────────────────────────────

describe('GET /api/v1/verify/:token', () => {
  it('should return session state', async () => {
    const session = mockSession();
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findEmailVerification).mockResolvedValue(null);
    vi.mocked(repo.findPhotoVerification).mockResolvedValue(null);
    vi.mocked(repo.findIdVerification).mockResolvedValue(null);
    vi.mocked(repo.findBookingBySessionId).mockResolvedValue(null);
    vi.mocked(repo.findSubmission).mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/verify/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe(session.id);
    expect(res.body.data.currentStep).toBe('email');
    expect(res.body.data.candidateName).toBe('Rajesh Kumar');
  });

  it('should return 404 for unknown token', async () => {
    const { token } = generateToken(
      { sessionId: 'unknown', candidateEmail: 'x@x.com', employerId: 'e' },
      72,
    );
    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/verify/${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── Step 1: Email OTP ────────────────────────────────────────────────

describe('Email verification flow', () => {
  it('should send OTP and verify it', async () => {
    const session = mockSession();
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findEmailVerification).mockResolvedValue(null);
    vi.mocked(repo.createEmailVerification).mockResolvedValue({
      id: 'ev-1',
      sessionId: session.id,
      email: session.candidateEmail,
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verified: false,
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Send OTP
    const sendRes = await request(app)
      .post(`/api/v1/verify/${token}/email/send-otp`)
      .send({ email: 'rajesh@example.com' });

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.message).toBe('OTP sent');
    expect(sendRes.body.data.expiresInSeconds).toBe(300);

    // Verify OTP
    vi.mocked(repo.findEmailVerification).mockResolvedValue({
      id: 'ev-1',
      sessionId: session.id,
      email: session.candidateEmail,
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verified: false,
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(repo.updateEmailVerification).mockResolvedValue({} as repo.EmailVerification);
    vi.mocked(repo.updateSession).mockResolvedValue(session);

    const verifyRes = await request(app)
      .post(`/api/v1/verify/${token}/email/verify-otp`)
      .send({ code: '123456' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);
    expect(repo.updateSession).toHaveBeenCalledWith(session.id, {
      status: 'email_verified',
      currentStep: 'photo',
    });
  });

  it('should reject wrong email', async () => {
    const session = mockSession();
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;
    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);

    const res = await request(app)
      .post(`/api/v1/verify/${token}/email/send-otp`)
      .send({ email: 'wrong@example.com' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid OTP', async () => {
    const session = mockSession();
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findEmailVerification).mockResolvedValue({
      id: 'ev-1',
      sessionId: session.id,
      email: session.candidateEmail,
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verified: false,
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/verify/${token}/email/verify-otp`)
      .send({ code: '000000' });

    expect(res.status).toBe(400);
  });
});

// ─── Step 2: Photo + Liveness ─────────────────────────────────────────

describe('Photo + liveness flow', () => {
  it('should submit liveness result and advance to id_proof', async () => {
    const session = mockSession({ status: 'email_verified' as repo.VerificationStatus, currentStep: 'photo' as repo.VerificationStep });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findPhotoVerification).mockResolvedValue({
      id: 'pv-1',
      sessionId: session.id,
      photoPath: 'uploads/photos/test.jpg',
      livenessCompleted: false,
      livenessScore: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(repo.updatePhotoVerification).mockResolvedValue({} as repo.PhotoVerification);
    vi.mocked(repo.updateSession).mockResolvedValue(session);

    const res = await request(app)
      .post(`/api/v1/verify/${token}/photo/liveness`)
      .send({ livenessScore: 0.92 });

    expect(res.status).toBe(200);
    expect(res.body.data.livenessScore).toBe(0.92);
    expect(repo.updateSession).toHaveBeenCalledWith(session.id, {
      status: 'photo_completed',
      currentStep: 'id_proof',
    });
  });
});

// ─── Step 3: ID Proof ─────────────────────────────────────────────────

describe('ID proof flow', () => {
  it('should confirm ID and advance to schedule', async () => {
    const session = mockSession({ status: 'photo_completed' as repo.VerificationStatus, currentStep: 'id_proof' as repo.VerificationStep });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findIdVerification).mockResolvedValue({
      id: 'iv-1',
      sessionId: session.id,
      idType: 'aadhaar' as repo.IdVerification['idType'],
      imagePath: 'uploads/id-proofs/test.jpg',
      extractedName: 'Rajesh Kumar',
      extractedData: { name: 'Rajesh Kumar', idType: 'aadhaar' },
      faceMatchScore: 0.94,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(repo.updateIdVerification).mockResolvedValue({} as repo.IdVerification);
    vi.mocked(repo.updateSession).mockResolvedValue(session);

    const res = await request(app)
      .post(`/api/v1/verify/${token}/id-proof/confirm`);

    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
    expect(repo.updateSession).toHaveBeenCalledWith(session.id, {
      candidateName: 'Rajesh Kumar',
      status: 'id_completed',
      currentStep: 'schedule',
    });
  });
});

// ─── Step 4: Schedule ─────────────────────────────────────────────────

describe('Schedule flow', () => {
  it('should return available slots', async () => {
    const session = mockSession({ status: 'id_completed' as repo.VerificationStatus, currentStep: 'schedule' as repo.VerificationStep });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(calendarService.getAvailableSlots).mockResolvedValue([
      { start: '2026-04-08T09:00:00Z', end: '2026-04-08T09:30:00Z' },
      { start: '2026-04-08T10:00:00Z', end: '2026-04-08T10:30:00Z' },
    ]);

    const res = await request(app).get(`/api/v1/verify/${token}/slots`);

    expect(res.status).toBe(200);
    expect(res.body.data.availableSlots).toHaveLength(2);
    expect(res.body.data.candidateName).toBe('Rajesh Kumar');
  });

  it('should book a slot', async () => {
    const session = mockSession({ status: 'id_completed' as repo.VerificationStatus, currentStep: 'schedule' as repo.VerificationStep });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findBookingBySessionId).mockResolvedValue(null);
    vi.mocked(calendarService.isSlotAvailable).mockResolvedValue(true);
    vi.mocked(calendarService.createEvent).mockResolvedValue({
      eventId: 'gcal-event-id',
      htmlLink: 'https://calendar.google.com/event/123',
    });
    const booking = {
      id: 'bk-1',
      sessionId: session.id,
      candidateEmail: session.candidateEmail,
      jobId: session.jobId,
      employerId: session.employerId,
      startTime: new Date('2026-04-08T10:00:00Z'),
      endTime: new Date('2026-04-08T10:30:00Z'),
      googleCalendarEventId: 'gcal-event-id',
      calendarId: session.calendarId,
      status: 'confirmed' as repo.BookingStatus,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(repo.createBooking).mockResolvedValue(booking);
    vi.mocked(repo.updateSession).mockResolvedValue(session);

    const res = await request(app)
      .post(`/api/v1/verify/${token}/book`)
      .send({ startTime: '2026-04-08T10:00:00Z' });

    expect(res.status).toBe(201);
    expect(res.body.data.bookingId).toBe('bk-1');
    expect(repo.updateSession).toHaveBeenCalledWith(session.id, {
      status: 'slot_booked',
      currentStep: 'review',
    });
  });

  it('should reject booking if slot is outside window', async () => {
    const session = mockSession({ status: 'id_completed' as repo.VerificationStatus, currentStep: 'schedule' as repo.VerificationStep });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findBookingBySessionId).mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/verify/${token}/book`)
      .send({ startTime: '2026-03-01T10:00:00Z' });

    expect(res.status).toBe(409);
  });
});

// ─── Step 5: Submit ───────────────────────────────────────────────────

describe('Submit flow', () => {
  it('should submit with geolocation and return reference number', async () => {
    const session = mockSession({ status: 'slot_booked' as repo.VerificationStatus, currentStep: 'review' as repo.VerificationStep });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findSubmission).mockResolvedValue(null);
    vi.mocked(repo.createSubmission).mockResolvedValue({
      id: 'sub-1',
      sessionId: session.id,
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      deviceInfo: 'Chrome · MacIntel',
      referenceNumber: 'VRF-2026-1234',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(repo.updateSession).mockResolvedValue(session);
    vi.mocked(repo.findBookingBySessionId).mockResolvedValue({
      id: 'bk-1',
      sessionId: session.id,
      candidateEmail: session.candidateEmail,
      jobId: session.jobId,
      employerId: session.employerId,
      startTime: new Date('2026-04-08T10:00:00Z'),
      endTime: new Date('2026-04-08T10:30:00Z'),
      googleCalendarEventId: 'gcal-event-id',
      calendarId: session.calendarId,
      status: 'confirmed' as repo.BookingStatus,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/verify/${token}/submit`)
      .send({
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 10,
        deviceInfo: 'Chrome · MacIntel',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.referenceNumber).toBe('VRF-2026-1234');
    expect(res.body.data.candidateName).toBe('Rajesh Kumar');
    expect(res.body.data.booking.startTime).toBeDefined();
    expect(repo.updateSession).toHaveBeenCalledWith(session.id, { status: 'completed' });
    expect(webhookService.fireAndForget).toHaveBeenCalled();
  });

  it('should reject duplicate submission', async () => {
    const session = mockSession({ status: 'slot_booked' as repo.VerificationStatus });
    const { token, jti } = tokenForSession(session);
    session.tokenJti = jti;

    vi.mocked(repo.findSessionByTokenJti).mockResolvedValue(session);
    vi.mocked(repo.findSubmission).mockResolvedValue({
      id: 'sub-1',
      sessionId: session.id,
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      deviceInfo: 'Chrome · MacIntel',
      referenceNumber: 'VRF-2026-1234',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/verify/${token}/submit`)
      .send({
        latitude: 12.9716,
        longitude: 77.5946,
        deviceInfo: 'Chrome · MacIntel',
      });

    expect(res.status).toBe(409);
  });
});

// ─── Admin: List, Get, Cancel ─────────────────────────────────────────

describe('Admin session management', () => {
  it('should list sessions with pagination', async () => {
    const session = mockSession();
    vi.mocked(repo.listSessions).mockResolvedValue({
      sessions: [session],
      nextCursor: null,
      hasMore: false,
    });

    const res = await request(app)
      .get('/api/v1/sessions')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sessionId).toBe(session.id);
    expect(res.body.meta.hasMore).toBe(false);
  });

  it('should get full session by ID', async () => {
    const session = mockSession();
    vi.mocked(repo.findFullSession).mockResolvedValue({
      ...session,
      emailVerification: null,
      photoVerification: null,
      idVerification: null,
      booking: null,
      submission: null,
    } as Awaited<ReturnType<typeof repo.findFullSession>>);

    const res = await request(app)
      .get(`/api/v1/sessions/${session.id}`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(session.id);
  });

  it('should cancel a session', async () => {
    const session = mockSession();
    vi.mocked(repo.findSessionById).mockResolvedValue(session);
    vi.mocked(repo.findBookingBySessionId).mockResolvedValue(null);
    vi.mocked(repo.updateSession).mockResolvedValue({ ...session, status: 'cancelled' as repo.VerificationStatus });

    const res = await request(app)
      .post(`/api/v1/sessions/${session.id}/cancel`)
      .set('x-api-key', API_KEY)
      .send({ reason: 'No longer needed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(webhookService.fireAndForget).toHaveBeenCalled();
  });

  it('should resend invitation', async () => {
    const session = mockSession();
    vi.mocked(repo.findSessionById).mockResolvedValue(session);
    vi.mocked(repo.updateSession).mockResolvedValue(session);

    const res = await request(app)
      .post(`/api/v1/sessions/${session.id}/resend`)
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.verificationLink).toContain('http://localhost:3000/verify/');
    expect(webhookService.fireAndForget).toHaveBeenCalled();
  });
});
