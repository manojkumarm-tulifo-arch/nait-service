# Developer Guide

## Project Structure

```
├── prisma/
│   ├── schema.prisma                 # Database schema (6 models)
│   └── migrations/                   # Prisma migration history
├── src/
│   ├── index.ts                      # Entry point: DB connect, server start, graceful shutdown
│   ├── app.ts                        # Express app factory (no listen — for testability)
│   ├── generated/prisma/             # Prisma generated client (gitignored)
│   ├── config/
│   │   ├── index.ts                  # Zod-validated environment config
│   │   └── google-calendar.ts        # Google service account client singleton
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma client singleton (adapter pattern)
│   │   ├── logger.ts                 # Pino structured logger
│   │   ├── errors.ts                 # Typed error classes (AppError hierarchy)
│   │   └── response.ts              # JSON envelope helpers: sendSuccess(), sendError()
│   ├── middleware/
│   │   ├── api-key-auth.ts           # API key validation (timing-safe compare)
│   │   ├── error-handler.ts          # Global error handler (catches all thrown errors)
│   │   ├── request-validator.ts      # Zod validation middleware factory
│   │   └── file-upload.ts            # Multer config for photo + ID uploads
│   ├── token/
│   │   ├── token.service.ts          # JWT sign/verify for verification links
│   │   ├── token.types.ts            # Token payload interface
│   │   └── token.test.ts
│   ├── calendar/
│   │   ├── calendar.service.ts       # Google Calendar freebusy + event CRUD
│   │   ├── calendar.types.ts         # TimeSlot, CalendarEvent interfaces
│   │   └── calendar.test.ts
│   ├── webhook/
│   │   ├── webhook.service.ts        # HTTP POST dispatcher with retries
│   │   ├── webhook.types.ts          # Event types and payload interface
│   │   └── webhook.test.ts
│   ├── verification/
│   │   ├── verification.repository.ts    # Prisma data access layer (all 6 models)
│   │   ├── verification.schemas.ts       # Zod request validation schemas
│   │   ├── verification.service.ts       # Core business logic (5-step flow)
│   │   ├── verification.controller.ts    # Thin HTTP req/res handlers
│   │   ├── verification.routes.ts        # Route definitions + middleware wiring
│   │   └── verification.integration.test.ts
│   └── health/
│       ├── health.controller.ts
│       └── health.routes.ts
├── client/                           # React frontend (Vite)
│   ├── public/models/                # face-api.js model weights
│   ├── src/
│   │   ├── App.tsx                   # Main app: token from URL, step routing
│   │   ├── api/verification.ts       # Typed API client (axios)
│   │   ├── components/
│   │   │   ├── Stepper.tsx           # 5-step progress bar
│   │   │   ├── OtpInput.tsx          # 6-digit OTP input with paste support
│   │   │   ├── EmailStep.tsx         # Email input + OTP verification
│   │   │   ├── PhotoStep.tsx         # Camera + liveness + preview
│   │   │   ├── IdProofStep.tsx       # ID type tabs + scan/upload + confirm
│   │   │   ├── ScheduleStep.tsx      # Date + time slot picker
│   │   │   ├── ReviewStep.tsx        # Summary cards + location grant
│   │   │   └── ConfirmationStep.tsx  # Success screen with ref number
│   │   └── hooks/
│   │       ├── useCamera.ts          # Webcam start/stop/capture
│   │       ├── useLiveness.ts        # face-api.js blink/smile detection
│   │       └── useGeolocation.ts     # Browser geolocation API
│   └── vite.config.ts               # Tailwind plugin + API proxy to :3000
├── uploads/                          # Local file storage (gitignored)
│   ├── photos/                       # Selfie images
│   └── id-proofs/                    # ID document images
├── docker-compose.yml                # PostgreSQL 17 + service
└── Dockerfile                        # Multi-stage build
```

## Architecture

### Request Flow

```
HTTP Request
  → Express middleware (helmet, cors, json, pino-http)
  → Static file serving (/uploads)
  → Route matcher
  → API key auth (admin routes only)
  → Zod request validation
  → Multer file upload (photo/ID routes only)
  → Controller (thin — parses req, calls service, sends response)
  → Service (business logic orchestration)
  → Repository (Prisma queries) / Calendar Service / Token Service / Webhook Service
  → Response envelope (sendSuccess/sendError)
  → Global error handler (catches any thrown errors)
```

### Key Design Patterns

**App Factory Pattern** — `app.ts` exports a `createApp()` function that returns the Express app without calling `.listen()`. This allows integration tests to use supertest directly without starting an HTTP server.

**Prisma v7 Adapter Pattern** — The Prisma client uses the driver adapter approach (`@prisma/adapter-pg` with `PrismaPg`), connecting directly via a PostgreSQL connection string instead of the Prisma engine binary.

**Token JTI Invalidation** — Each verification session stores the `jti` (JWT ID) of its current active token. When resending an invitation, a new token with a new `jti` is generated and the session is updated. The old token becomes invalid because it no longer matches the session's `tokenJti` field.

**Step-based State Machine** — Sessions progress through a defined status/step sequence:
```
email_pending → email_verified → photo_completed → id_completed → slot_booked → completed
```
Each API call validates the current step and advances it on success.

**Race Condition Guard** — When a candidate books a slot, the service re-checks Google Calendar freebusy to verify the slot is still available. This prevents double-bookings when multiple candidates view slots simultaneously.

**Sequential OTP Verification** — The frontend verifies email and phone OTPs sequentially (not via `Promise.all`). Each backend call checks whether the other channel is already verified before advancing the session. Running them concurrently would cause a race condition where neither call sees the other as committed, preventing session advancement.

**End-Date-as-Next-Day-Midnight** — The admin date picker shows a "to" date representing the last selectable day. Internally, the scheduling window end is stored as midnight of the *next* day (e.g., user picks April 10 → stored as April 11 00:00:00). This ensures the entire last day is included when generating slots, and the 11 PM–12 AM slot is not excluded by an off-by-one-second boundary.

**Local-Time Slot Alignment** — Slot generation starts the cursor directly from the admin's `windowStart` (which is midnight local time). This ensures slots fall on clean local-time hour boundaries (12 AM, 1 AM, …, 11 PM). Snapping to UTC hour boundaries would misalign for timezones with non-hour offsets (e.g., IST at UTC+5:30 would produce 12:30 AM slots).

**2-Hour Booking Buffer** — Slots that start within the next 2 hours are filtered out, giving candidates time to complete remaining verification steps before the interview.

**Scheduling Window Expiry** — When a candidate opens their verification link, `getSessionState` checks whether the scheduling window has ended. If so, the session is automatically marked as `expired` in the database and the candidate sees an expiry message instead of the verification wizard.

**Completed Session Detection on Refresh** — After final submission, if the candidate refreshes the page, the frontend reconstructs the confirmation result from the session's `submission` data (reference number, booking times) rather than sending the candidate back to the ReviewStep.

**Webhook Fire-and-Forget** — Webhook dispatch is asynchronous with up to 2 retries and exponential backoff. It logs failures but never blocks the primary business flow.

**Validated Query Storage** — Express 5 makes `req.query` and `req.params` read-only. Validated query data is stored on `req.validated_query` by the validation middleware and read from there in controllers.

**Browser-based Liveness** — Liveness detection runs entirely in the browser using face-api.js. The backend receives only the final score — no video/frame processing on the server.

## Data Models

### VerificationSession

Parent entity for the entire verification flow.

Status lifecycle: `email_pending` → `email_verified` → `photo_completed` → `id_completed` → `slot_booked` → `completed` | `cancelled` | `expired`

Sessions are automatically moved to `expired` when the candidate opens their link after the scheduling window has ended.

Step sequence: `email` → `photo` → `id_proof` → `schedule` → `review`

Key fields:
- `tokenJti` / `tokenExpiresAt` — current active verification link token
- `schedulingWindowStart` / `schedulingWindowEnd` — time range for slot selection
- `slotDurationMinutes` — length of each bookable slot
- `calendarId` — Google Calendar to check/book on
- `webhookUrl` — where to POST notifications

### EmailVerification (1:1 with session)

OTP-based email verification. Currently uses hardcoded OTP `123456`.

### PhotoVerification (1:1 with session)

Stores selfie photo path and liveness check result (score 0-1).

### IdVerification (1:1 with session)

Stores ID document image, type (aadhaar/pan/passport/dl), mock-extracted name, and face match score.

### Booking (1:1 with session)

Interview slot booking with Google Calendar event ID for cancellation.

### Submission (1:1 with session)

Final submission record: geolocation (lat/lng/accuracy), device info, and reference number (VRF-YYYY-XXXX).

## Testing

### Test Setup

Tests use Vitest with environment variables configured in `vitest.config.ts`. External dependencies (Prisma repository, Google Calendar, webhooks) are mocked.

```bash
npm test                # Run all 39 tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

### Test Files

| File | Tests | What it covers |
|------|-------|----------------|
| `token/token.test.ts` | 6 | JWT generate/verify, expiry, tampering |
| `calendar/calendar.test.ts` | 10 | Slot calculation, busy periods, events, 2-hour buffer, local-time alignment |
| `webhook/webhook.test.ts` | 4 | Dispatch, retry logic, timeout handling |
| `verification/verification.integration.test.ts` | 19 | Full HTTP flow via supertest: admin CRUD, email + phone OTP, photo/liveness, ID proof, scheduling, submission, auth/validation errors |

### Integration Test Approach

`verification.integration.test.ts` uses:
- `supertest` for HTTP assertions against the Express app
- Mocked repository layer (all Prisma calls)
- Mocked calendar service and webhook service
- Real token generation/verification (JWT)

The tests cover the complete lifecycle:
1. Admin creates session → verify link generated + webhook fired
2. Send OTP → verify correct email required
3. Verify OTP → verify step advances to photo
4. Submit liveness → verify step advances to id_proof
5. Confirm ID → verify step advances to schedule
6. Get slots → verify calendar integration
7. Book slot → verify calendar re-check + event creation
8. Submit → verify geolocation, reference number, webhook
9. Auth failures, validation errors, duplicate prevention

## Google Calendar Setup

1. Create a Google Cloud project and enable the Calendar API
2. Create a service account and download the JSON key file
3. Share the target Google Calendar with the service account email (grant "Make changes to events" permission)
4. Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` to the key file path
5. Set `GOOGLE_CALENDAR_ID` to the calendar's ID (found in calendar settings)

## File Uploads

Photos and ID images are stored locally in `uploads/`:
- `uploads/photos/{uuid}.{ext}` — selfie images
- `uploads/id-proofs/{uuid}.{ext}` — ID document images

Multer config (`middleware/file-upload.ts`):
- 10MB max file size
- Accepted types: JPEG, PNG, WebP
- UUID-based filenames

The backend serves these via `/uploads/*` static route.

## Frontend Development

The React frontend runs on Vite dev server (`:5173`) with API proxy to the backend (`:3000`).

```bash
cd client
npm run dev      # Dev server with HMR
npm run build    # Production build → client/dist/
```

The app reads the JWT token from the URL path (`/:token`), fetches session state from the backend, and renders the appropriate step component. Each step calls the backend API on completion and triggers a session state reload to advance.

face-api.js model weights are in `client/public/models/` (loaded at runtime for liveness detection).

## Adding New Endpoints

1. Add the Zod schema in `verification/verification.schemas.ts`
2. Add the repository function in `verification/verification.repository.ts`
3. Add the service method in `verification/verification.service.ts`
4. Add the controller handler in `verification/verification.controller.ts`
5. Add the route in `verification/verification.routes.ts`
6. Add integration test cases in `verification/verification.integration.test.ts`

## Error Handling

All errors are caught by the global error handler (`middleware/error-handler.ts`):

| Error Type | HTTP Status | Code |
|------------|-------------|------|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `TokenError` | 401 | `TOKEN_EXPIRED` / `TOKEN_INVALID` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `CalendarError` | 502 | `CALENDAR_ERROR` |
| Prisma `P2002` | 409 | `CONFLICT` |
| Prisma `P2025` | 404 | `NOT_FOUND` |
| Unhandled | 500 | `INTERNAL_SERVER_ERROR` |

All responses follow the envelope format:

```json
// Success
{ "data": { ... }, "meta": { ... } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

## Docker

```bash
# Build and run with PostgreSQL (starts nait-service + postgres)
docker compose up

# Build image only
docker build -t nait-service .

# Run standalone (requires external PostgreSQL)
docker run -p 3000:3000 --env-file .env nait-service
```

The Dockerfile uses a multi-stage build: Prisma generate + TypeScript compilation in the builder stage, then a slim runtime image with production dependencies only, running as a non-root user.
