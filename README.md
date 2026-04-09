# NAIT Service

Verification and scheduling microservice for the Tulifo-VIDEO platform. Candidates complete a 5-step KYC wizard (email, photo + liveness, ID proof, schedule, review) before their interview is confirmed.

## Features

- **Email + Phone Verification** — 6-digit OTP sent to the candidate's email and phone (hardcoded for now, pluggable). Phone numbers are validated as `+91` followed by exactly 10 digits.
- **Photo + Liveness** — Browser-based selfie capture with blink/smile detection via face-api.js
- **ID Proof** — Upload/scan government ID (Aadhaar, PAN, Passport, DL) with mock OCR and face match
- **Interview Scheduling** — 1-hour slot picker backed by Google Calendar freebusy queries. Slots align to clean local-time hour boundaries (12 AM, 1 AM, …, 11 PM). A 2-hour buffer prevents candidates from booking slots that start within the next 2 hours.
- **Review & Submit** — Summary of all data, geolocation capture, detailed device fingerprint (browser, OS, screen, timezone, cores, memory, network, touch, DPR), reference number generation
- **Admin API** — Create sessions with date-only scheduling window picker (no time selection). Sessions auto-expire when the scheduling window ends.
- **Webhook Notifications** — Fire-and-forget HTTP callbacks for invitation_sent, booking_confirmed, booking_cancelled

## Tech Stack

### Backend

- Node.js + Express 5 + TypeScript
- PostgreSQL + Prisma v7 (driver adapter)
- Google Calendar API (service account)
- JWT-based verification links
- Zod v4 validation
- Pino structured logging
- Multer file uploads

### Frontend

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4
- face-api.js (browser-based liveness detection)
- Axios

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 17+ (local or Docker)
- Google Cloud service account with Calendar API enabled

### Setup

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Copy and configure environment
cp .env.example .env
# Edit .env with your values

# Run database migrations
npx prisma migrate dev

# Development mode (hot reload)
npm run dev          # Backend on :3000
cd client && npm run dev  # Frontend on :5173 (proxies to backend)

# Or with Docker (starts nait-service + PostgreSQL)
docker compose up
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `API_KEY` | API key for admin endpoints | — |
| `JWT_SECRET` | Secret for signing verification tokens (min 32 chars) | — |
| `JWT_ISSUER` | JWT issuer claim | `tulifo-video-nait` |
| `VERIFICATION_BASE_URL` | Base URL for verification links | — |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Path to Google service account JSON | — |
| `GOOGLE_CALENDAR_ID` | Google Calendar ID | `primary` |
| `DEFAULT_WEBHOOK_URL` | Default webhook URL for notifications | — |
| `DEFAULT_LINK_EXPIRY_HOURS` | Link expiration time | `72` |
| `DEFAULT_SLOT_DURATION_MINUTES` | Default slot length | `60` |
| `LOG_LEVEL` | Pino log level | `info` |
| `NODE_ENV` | Environment | `development` |

## API Endpoints

### Public (JWT token in URL)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/verify/:token` | Get current session state and step data |
| `POST` | `/api/v1/verify/:token/email/send-otp` | Send 6-digit OTP to candidate's email |
| `POST` | `/api/v1/verify/:token/email/verify-otp` | Verify OTP code |
| `POST` | `/api/v1/verify/:token/photo` | Upload selfie photo (multipart) |
| `POST` | `/api/v1/verify/:token/photo/liveness` | Submit liveness check result |
| `POST` | `/api/v1/verify/:token/id-proof` | Upload ID document image (multipart) |
| `POST` | `/api/v1/verify/:token/id-proof/confirm` | Confirm extracted ID data |
| `GET` | `/api/v1/verify/:token/slots` | Get available interview slots |
| `POST` | `/api/v1/verify/:token/book` | Book an interview slot |
| `POST` | `/api/v1/verify/:token/submit` | Final submission with geolocation + device info |

### Admin (API key required via `x-api-key` header)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/sessions` | Create verification session |
| `GET` | `/api/v1/sessions` | List sessions (filterable, paginated) |
| `GET` | `/api/v1/sessions/:sessionId` | Get full session with all step data |
| `POST` | `/api/v1/sessions/:sessionId/cancel` | Cancel a session |
| `POST` | `/api/v1/sessions/:sessionId/resend` | Resend invitation link |

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Readiness check (DB ping) |

## Scripts

```bash
# Backend
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm start            # Run compiled JS
npm test             # Run tests (39 tests)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run typecheck    # Type check without emitting

# Frontend
cd client
npm run dev          # Vite dev server with HMR
npm run build        # Production build
npm run preview      # Preview production build
```

## Webhook Events

The service fires HTTP POST webhooks for these events:

- `invitation_sent` — When a verification link is created or resent
- `booking_confirmed` — When a candidate completes the full verification + booking flow
- `booking_cancelled` — When an admin cancels a session

Each payload includes `eventType`, `timestamp`, `sessionId`, and event-specific `data`.

## Verification Flow

```
1. Admin creates session via POST /api/v1/sessions
   → Selects date-only scheduling window (today or future dates)
   → End date stored internally as midnight of the next day for full-day coverage
   → Generates JWT verification link
   → Fires invitation_sent webhook
   → "Copy Link" button shows a toast notification on success

2. Candidate opens link in browser (React frontend)
   → If scheduling window has ended → shows "expired" message
   → Step 1: Email + Phone — enter details, receive OTPs, verify both (sequential)
   → Step 2: Photo — open camera, liveness check (blink + smile), capture
   → Step 3: ID Proof — select ID type, scan/upload, confirm extracted data
   → Step 4: Schedule — 1-hour slots from 12 AM to 11 PM, starting 2 hours from now
   → Step 5: Review — grant location, review summary, submit

3. On submit:
   → Generates reference number (VRF-YYYY-XXXX)
   → Records geolocation + device info
   → Fires booking_confirmed webhook
   → Shows confirmation screen (persists across page refresh)
```
