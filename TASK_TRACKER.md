# NAIT Service — Task Tracker

**Project**: Verification + KYC + Scheduling Service (NAIT)
**Last Updated**: 2026-04-06

---

## Phase 1: Database & Backend

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Prisma schema — 6 models (VerificationSession, EmailVerification, PhotoVerification, IdVerification, Booking, Submission) | DONE | `prisma/schema.prisma` |
| 2 | Database migration applied | DONE | PostgreSQL 17 via Docker on port 5433 |
| 3 | Verification repository (CRUD for all models) | DONE | `src/verification/verification.repository.ts` |
| 4 | Verification service (5-step business logic) | DONE | `src/verification/verification.service.ts` |
| 5 | Verification controller + routes (10 public + 5 admin endpoints) | DONE | `src/verification/verification.controller.ts`, `verification.routes.ts` |
| 6 | Zod validation schemas | DONE | `src/verification/verification.schemas.ts` |
| 7 | File upload middleware (multer) | DONE | `src/middleware/file-upload.ts` — photos + ID proofs, 10MB limit, image type validation |
| 8 | Google Calendar — dual auth mode (service-account + OAuth 2.0) | DONE | `src/config/google-calendar.ts` |
| 9 | JWT token service (VerificationTokenPayload) | DONE | `src/token/token.service.ts` |
| 10 | Project rename: scheduler-service to nait-service | DONE | package.json, docker-compose.yml, logger, index.ts |
| 11 | Backend integration tests | DONE | `src/verification/verification.integration.test.ts` — 19 test cases |

---

## Phase 2: Frontend (React + Vite + Tailwind)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | Scaffold React + Vite + Tailwind project | DONE | `client/` directory |
| 13 | API client with typed endpoints | DONE | `client/src/api/verification.ts` — 10 endpoints |
| 14 | App.tsx — 5-step wizard routing | DONE | Token from URL, session state loading, step rendering |
| 15 | Stepper component (progress bar) | DONE | `client/src/components/Stepper.tsx` |
| 16 | OtpInput component (6-digit input) | DONE | `client/src/components/OtpInput.tsx` |
| 17 | Step 1: EmailStep (OTP send + verify) | DONE | Hardcoded OTP "123456" |
| 18 | Step 2: PhotoStep (camera + liveness) | DONE | face-api.js blink/smile detection, auto-capture, fallback upload |
| 19 | Step 3: IdProofStep (ID type tabs + camera/upload) | DONE | Fixed: camera race condition (useEffect for start) |
| 20 | Step 4: ScheduleStep (date + time slot picker) | DONE | Google Calendar freebusy integration |
| 21 | Step 5: ReviewStep (summary + location + submit) | DONE | Geolocation grant, device info capture |
| 22 | ConfirmationStep (success + reference number) | DONE | |
| 23 | useCamera hook | DONE | `client/src/hooks/useCamera.ts` |
| 24 | useLiveness hook (face-api.js) | DONE | EAR blink detection (82% drop ratio), smile detection (0.45 threshold) |
| 25 | useGeolocation hook | DONE | `client/src/hooks/useGeolocation.ts` |
| 26 | face-api.js model weights | DONE | `client/public/models/` — tinyFaceDetector, faceLandmark68, faceExpression |

---

## Phase 3: Config & Documentation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 27 | docker-compose.yml (PostgreSQL + app) | DONE | Port 5433, health checks |
| 28 | .env.example with both auth modes | DONE | |
| 29 | .env configured for local dev | DONE | Google OAuth creds, local PostgreSQL |
| 30 | README.md | DONE | Full feature docs, API reference, quick start |
| 31 | DEVELOPER.md | DONE | Architecture, data models, testing guide, adding endpoints guide |

---

## Phase 4: Bug Fixes (from testing)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 32 | Liveness: tiny landmark model too imprecise | DONE | Switched to full faceLandmark68Net |
| 33 | Liveness: absolute EAR threshold too rigid | DONE | Switched to relative baseline calibration |
| 34 | Liveness: overlapping async setInterval callbacks | DONE | Rewrote to requestAnimationFrame loop |
| 35 | Liveness: blink not detecting (threshold too aggressive) | DONE | Relaxed to 82% drop ratio + no-face fallback |
| 36 | Liveness: auto-capture running during render | DONE | Moved to useEffect with 300ms delay + fallback button |
| 37 | Liveness: debug overlay removal | DONE | Removed after liveness confirmed working |
| 38 | IdProofStep: camera not showing (race condition) | DONE | videoRef null because start() called before video rendered; fixed with useEffect |
| 39 | IdProofStep: captured image not displayed | DONE | Added previewUrl state, show image in extracting + result phases |
| 40 | Mock OCR overwriting candidate name with "Rajesh Kumar" | DONE | Changed to use session's actual candidateName |
| 41 | Docker port 5432 conflict | DONE | Mapped to 5433 |
| 42 | Test UUID format invalid for Zod validation | DONE | Fixed version/variant bits |
| 43 | Test assertions referencing old "scheduling" strings | DONE | Updated to "verification" |

---

## Pending / Future Work

| # | Task | Status | Notes |
|---|------|--------|-------|
| 44 | Real OTP delivery (email/SMS) | PENDING | Currently hardcoded to "123456" |
| 45 | Real OCR service integration | PENDING | Currently mock — returns session candidateName |
| 46 | Real face-match scoring | PENDING | Currently returns hardcoded 0.94 |
| 47 | Frontend unit tests (React components) | PENDING | Only backend integration tests exist |
| 48 | E2E tests (Playwright/Cypress) | PENDING | No browser-level tests |
| 49 | Production file storage (S3/GCS) | PENDING | Currently local filesystem `uploads/` |
| 50 | Email notifications (invitation, confirmation) | PENDING | Only webhook notifications exist |
| 51 | Rate limiting on public endpoints | PENDING | |
| 52 | HTTPS / production deployment config | PENDING | Currently HTTP localhost only |

---

## Summary

- **Total tasks**: 52
- **Completed**: 43 (83%)
- **Pending**: 9 (17%) — all are production hardening / future enhancements, not MVP blockers
