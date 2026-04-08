/**
 * JWT payload embedded in each verification link.
 *
 * The `jti` (JWT ID) is stored on the VerificationSession row and acts
 * as a single-use nonce: when an admin resends the invitation a new token
 * with a fresh jti is generated and the old token becomes invalid because
 * its jti no longer matches the session.
 */
export interface VerificationTokenPayload {
  sessionId: string;
  candidateEmail?: string;
  employerId: string;
  jti: string;  // Unique token ID — used for invalidation on resend
}
