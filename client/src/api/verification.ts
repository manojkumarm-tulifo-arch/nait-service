import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

// Unwrap { success, data } envelope
function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export interface SessionState {
  sessionId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  jobTitle: string;
  status: string;
  currentStep: 'email' | 'photo' | 'id_proof' | 'schedule' | 'review';
  email: { verified: boolean; email: string } | null;
  phone: { verified: boolean; phone: string } | null;
  photo: { completed: boolean; livenessCompleted: boolean; livenessScore: number | null; photoUrl: string | null } | null;
  idProof: { verified: boolean; idType: string; extractedName: string | null; faceMatchScore: number | null; imageUrl: string | null } | null;
  booking: { startTime: string; endTime: string; timeRemainingMs: number } | null;
  submission: { referenceNumber: string; submittedAt: string } | null;
}

export interface SlotInfo {
  start: string;
  end: string;
  available: boolean;
}

export interface AvailableSlots {
  candidateName: string;
  schedulingWindow: { start: string; end: string };
  slotDurationMinutes: number;
  availableSlots: SlotInfo[];
}

export interface BookingResult {
  bookingId: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface SubmitResult {
  referenceNumber: string;
  candidateName: string;
  candidateEmail: string;
  booking: { startTime: string; endTime: string } | null;
}

export function getSessionState(token: string) {
  return api.get(`/verify/${token}`).then(unwrap<SessionState>);
}

export function sendOtp(token: string, email: string) {
  return api.post(`/verify/${token}/email/send-otp`, { email }).then(unwrap<{ message: string; expiresInSeconds: number }>);
}

export function verifyOtp(token: string, code: string) {
  return api.post(`/verify/${token}/email/verify-otp`, { code }).then(unwrap<{ verified: boolean; message: string }>);
}

export function uploadPhoto(token: string, file: Blob) {
  const fd = new FormData();
  fd.append('photo', file, 'selfie.jpg');
  return api.post(`/verify/${token}/photo`, fd).then(unwrap<{ message: string; photoPath: string }>);
}

export function submitLiveness(token: string, livenessScore: number) {
  return api.post(`/verify/${token}/photo/liveness`, { livenessScore }).then(unwrap<{ message: string; livenessScore: number }>);
}

export function uploadIdProof(token: string, idType: string, file: Blob) {
  const fd = new FormData();
  fd.append('idImage', file, 'id-proof.jpg');
  fd.append('idType', idType);
  return api.post(`/verify/${token}/id-proof`, fd).then(unwrap<{ extractedName: string; faceMatchScore: number; message: string }>);
}

export function confirmIdProof(token: string) {
  return api.post(`/verify/${token}/id-proof/confirm`).then(unwrap<{ verified: boolean; message: string }>);
}

export function getAvailableSlots(token: string) {
  return api.get(`/verify/${token}/slots`).then(unwrap<AvailableSlots>);
}

export function bookSlot(token: string, startTime: string) {
  return api.post(`/verify/${token}/book`, { startTime }).then(unwrap<BookingResult>);
}

export function sendPhoneOtp(token: string, phone: string) {
  return api.post(`/verify/${token}/phone/send-otp`, { phone }).then(unwrap<{ message: string; expiresInSeconds: number }>);
}

export function verifyPhoneOtp(token: string, code: string) {
  return api.post(`/verify/${token}/phone/verify-otp`, { code }).then(unwrap<{ verified: boolean; message: string }>);
}

export function submitVerification(token: string, data: { latitude: number; longitude: number; accuracy?: number; deviceInfo: string }) {
  return api.post(`/verify/${token}/submit`, data).then(unwrap<SubmitResult>);
}

// --- Admin API ---

export interface CreateSessionInput {
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  jobId: string;
  jobTitle: string;
  employerId: string;
  schedulingWindowStart: string;
  schedulingWindowEnd: string;
}

export interface CreateSessionResult {
  sessionId: string;
  verificationLink: string;
  status: string;
  tokenExpiresAt: string;
}

const ADMIN_API_KEY = 'local-dev-api-key-change-in-prod';

export function createSession(input: CreateSessionInput) {
  return api.post('/sessions', input, {
    headers: { 'x-api-key': ADMIN_API_KEY },
  }).then(unwrap<CreateSessionResult>);
}
