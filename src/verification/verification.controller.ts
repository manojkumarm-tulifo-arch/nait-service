/**
 * Verification HTTP controllers — thin request/response handlers.
 *
 * Each handler extracts data from the request (params, body, file),
 * delegates to the service layer, and wraps the result in the standard
 * JSON envelope via sendSuccess(). No business logic lives here.
 */

import type { Request, Response } from 'express';
import * as service from './verification.service.js';
import { sendSuccess } from '../lib/response.js';
import type { CreateSessionInput, ListSessionsQuery } from './verification.schemas.js';

// --- Public (token-based) ---

export async function getSessionState(req: Request, res: Response) {
  const token = req.params.token as string;
  const data = await service.getSessionState(token);
  sendSuccess(res, data);
}

export async function sendOtp(req: Request, res: Response) {
  const token = req.params.token as string;
  const { email } = req.body;
  const data = await service.sendOtp(token, email);
  sendSuccess(res, data);
}

export async function verifyOtp(req: Request, res: Response) {
  const token = req.params.token as string;
  const { code } = req.body;
  const data = await service.verifyOtp(token, code);
  sendSuccess(res, data);
}

export async function sendPhoneOtp(req: Request, res: Response) {
  const token = req.params.token as string;
  const { phone } = req.body;
  const data = await service.sendPhoneOtp(token, phone);
  sendSuccess(res, data);
}

export async function verifyPhoneOtp(req: Request, res: Response) {
  const token = req.params.token as string;
  const { code } = req.body;
  const data = await service.verifyPhoneOtp(token, code);
  sendSuccess(res, data);
}

export async function uploadPhoto(req: Request, res: Response) {
  const token = req.params.token as string;
  if (!req.file) {
    res.status(400).json({ error: { code: 'MISSING_FILE', message: 'Photo file is required' } });
    return;
  }
  const data = await service.uploadPhoto(token, req.file.path);
  sendSuccess(res, data);
}

export async function submitLivenessResult(req: Request, res: Response) {
  const token = req.params.token as string;
  const { livenessScore } = req.body;
  const data = await service.submitLivenessResult(token, livenessScore);
  sendSuccess(res, data);
}

export async function uploadIdProof(req: Request, res: Response) {
  const token = req.params.token as string;
  const idType = req.body.idType || ((req as unknown as Record<string, unknown>).validated_query as Record<string, string>)?.idType;
  if (!req.file) {
    res.status(400).json({ error: { code: 'MISSING_FILE', message: 'ID image file is required' } });
    return;
  }
  const data = await service.uploadIdProof(token, idType, req.file.path);
  sendSuccess(res, data);
}

export async function confirmIdProof(req: Request, res: Response) {
  const token = req.params.token as string;
  const data = await service.confirmIdProof(token);
  sendSuccess(res, data);
}

export async function getAvailableSlots(req: Request, res: Response) {
  const token = req.params.token as string;
  const data = await service.getAvailableSlots(token);
  sendSuccess(res, data);
}

export async function bookSlot(req: Request, res: Response) {
  const token = req.params.token as string;
  const { startTime } = req.body;
  const data = await service.bookSlot(token, startTime);
  sendSuccess(res, data, 201);
}

export async function submit(req: Request, res: Response) {
  const token = req.params.token as string;
  const data = await service.submit(token, req.body);
  sendSuccess(res, data, 201);
}

// --- Admin (API key) ---

export async function createSession(req: Request, res: Response) {
  const input = req.body as CreateSessionInput;
  const result = await service.createSession(input);
  sendSuccess(res, {
    sessionId: result.session.id,
    verificationLink: result.verificationLink,
    status: result.session.status,
    tokenExpiresAt: result.session.tokenExpiresAt.toISOString(),
  }, 201);
}

export async function listSessions(req: Request, res: Response) {
  const query = ((req as unknown as Record<string, unknown>).validated_query ?? req.query) as ListSessionsQuery;
  const result = await service.listSessions(query);
  sendSuccess(
    res,
    result.sessions.map((s) => ({
      sessionId: s.id,
      candidateName: s.candidateName,
      candidateEmail: s.candidateEmail,
      jobTitle: s.jobTitle,
      employerId: s.employerId,
      status: s.status,
      currentStep: s.currentStep,
      createdAt: s.createdAt.toISOString(),
    })),
    200,
    { nextCursor: result.nextCursor, hasMore: result.hasMore, pageSize: query.pageSize ?? 20 },
  );
}

export async function getFullSession(req: Request, res: Response) {
  const sessionId = req.params.sessionId as string;
  const data = await service.getFullSession(sessionId);
  sendSuccess(res, data);
}

export async function cancelSession(req: Request, res: Response) {
  const sessionId = req.params.sessionId as string;
  const { reason } = req.body ?? {};
  const session = await service.cancelSession(sessionId, reason);
  sendSuccess(res, { sessionId: session.id, status: session.status });
}

export async function resendInvitation(req: Request, res: Response) {
  const sessionId = req.params.sessionId as string;
  const result = await service.resendInvitation(sessionId);
  sendSuccess(res, {
    sessionId: result.session.id,
    verificationLink: result.verificationLink,
    status: result.session.status,
  });
}
