-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('email_pending', 'email_verified', 'photo_completed', 'id_completed', 'slot_booked', 'completed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "VerificationStep" AS ENUM ('email', 'photo', 'id_proof', 'schedule', 'review');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('aadhaar', 'pan', 'passport', 'dl');

-- CreateTable
CREATE TABLE "verification_sessions" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidatePhone" TEXT,
    "jobId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'email_pending',
    "currentStep" "VerificationStep" NOT NULL DEFAULT 'email',
    "tokenJti" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "schedulingWindowStart" TIMESTAMP(3) NOT NULL,
    "schedulingWindowEnd" TIMESTAMP(3) NOT NULL,
    "slotDurationMinutes" INTEGER NOT NULL,
    "calendarId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpCode" TEXT NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_verifications" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "photoPath" TEXT NOT NULL,
    "livenessCompleted" BOOLEAN NOT NULL DEFAULT false,
    "livenessScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "id_verifications" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "idType" "IdType" NOT NULL,
    "imagePath" TEXT NOT NULL,
    "extractedName" TEXT,
    "extractedData" JSONB,
    "faceMatchScore" DOUBLE PRECISION,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "id_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "googleCalendarEventId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "deviceInfo" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_sessions_tokenJti_key" ON "verification_sessions"("tokenJti");

-- CreateIndex
CREATE INDEX "verification_sessions_employerId_status_createdAt_idx" ON "verification_sessions"("employerId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_sessionId_key" ON "email_verifications"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "photo_verifications_sessionId_key" ON "photo_verifications"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "id_verifications_sessionId_key" ON "id_verifications"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_sessionId_key" ON "bookings"("sessionId");

-- CreateIndex
CREATE INDEX "bookings_employerId_status_startTime_idx" ON "bookings"("employerId", "status", "startTime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_sessionId_key" ON "submissions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_referenceNumber_key" ON "submissions"("referenceNumber");

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_verifications" ADD CONSTRAINT "photo_verifications_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "verification_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
