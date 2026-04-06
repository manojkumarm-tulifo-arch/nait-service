/**
 * Verification route definitions.
 *
 * Two groups:
 *   Public routes (/verify/:token/...)  — authenticated by JWT in the URL path.
 *   Admin routes  (/sessions/...)       — authenticated by x-api-key header.
 *
 * Each route applies its middleware in order:
 *   param validation → auth (admin only) → body/query validation → file upload → controller
 */

import { Router } from 'express';
import { apiKeyAuth } from '../middleware/api-key-auth.js';
import { validate } from '../middleware/request-validator.js';
import { upload } from '../middleware/file-upload.js';
import * as controller from './verification.controller.js';
import {
  createSessionSchema, sendOtpSchema, verifyOtpSchema,
  sendPhoneOtpSchema, verifyPhoneOtpSchema,
  livenessResultSchema, bookSlotSchema, submitSchema,
  cancelSessionSchema, listSessionsQuerySchema,
  tokenParamSchema, sessionIdParamSchema,
} from './verification.schemas.js';

const router = Router();

// --- Public routes (JWT token in URL) ---

router.get(
  '/verify/:token',
  validate(tokenParamSchema, 'params'),
  controller.getSessionState,
);

router.post(
  '/verify/:token/email/send-otp',
  validate(tokenParamSchema, 'params'),
  validate(sendOtpSchema, 'body'),
  controller.sendOtp,
);

router.post(
  '/verify/:token/email/verify-otp',
  validate(tokenParamSchema, 'params'),
  validate(verifyOtpSchema, 'body'),
  controller.verifyOtp,
);

router.post(
  '/verify/:token/phone/send-otp',
  validate(tokenParamSchema, 'params'),
  validate(sendPhoneOtpSchema, 'body'),
  controller.sendPhoneOtp,
);

router.post(
  '/verify/:token/phone/verify-otp',
  validate(tokenParamSchema, 'params'),
  validate(verifyPhoneOtpSchema, 'body'),
  controller.verifyPhoneOtp,
);

router.post(
  '/verify/:token/photo',
  validate(tokenParamSchema, 'params'),
  upload.single('photo'),
  controller.uploadPhoto,
);

router.post(
  '/verify/:token/photo/liveness',
  validate(tokenParamSchema, 'params'),
  validate(livenessResultSchema, 'body'),
  controller.submitLivenessResult,
);

router.post(
  '/verify/:token/id-proof',
  validate(tokenParamSchema, 'params'),
  upload.single('idImage'),
  controller.uploadIdProof,
);

router.post(
  '/verify/:token/id-proof/confirm',
  validate(tokenParamSchema, 'params'),
  controller.confirmIdProof,
);

router.get(
  '/verify/:token/slots',
  validate(tokenParamSchema, 'params'),
  controller.getAvailableSlots,
);

router.post(
  '/verify/:token/book',
  validate(tokenParamSchema, 'params'),
  validate(bookSlotSchema, 'body'),
  controller.bookSlot,
);

router.post(
  '/verify/:token/submit',
  validate(tokenParamSchema, 'params'),
  validate(submitSchema, 'body'),
  controller.submit,
);

// --- Admin routes (API key) ---

router.post(
  '/sessions',
  apiKeyAuth,
  validate(createSessionSchema, 'body'),
  controller.createSession,
);

router.get(
  '/sessions',
  apiKeyAuth,
  validate(listSessionsQuerySchema, 'query'),
  controller.listSessions,
);

router.get(
  '/sessions/:sessionId',
  apiKeyAuth,
  validate(sessionIdParamSchema, 'params'),
  controller.getFullSession,
);

router.post(
  '/sessions/:sessionId/cancel',
  apiKeyAuth,
  validate(sessionIdParamSchema, 'params'),
  validate(cancelSessionSchema, 'body'),
  controller.cancelSession,
);

router.post(
  '/sessions/:sessionId/resend',
  apiKeyAuth,
  validate(sessionIdParamSchema, 'params'),
  controller.resendInvitation,
);

export { router as verificationRouter };
