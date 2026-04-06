/**
 * JWT token service for verification links.
 *
 * Each verification link embeds a signed JWT containing the session ID,
 * candidate email, employer ID, and a unique jti. The jti is persisted on
 * the session row so we can invalidate old tokens when the admin resends
 * the invitation — only the token whose jti matches the session is accepted.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { TokenError } from '../lib/errors.js';
import type { VerificationTokenPayload } from './token.types.js';

/** Create a signed JWT with a unique jti and the given expiry. */
export function generateToken(
  payload: Omit<VerificationTokenPayload, 'jti'>,
  expiresInHours: number,
): { token: string; jti: string; expiresAt: Date } {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const token = jwt.sign(
    {
      sessionId: payload.sessionId,
      candidateEmail: payload.candidateEmail,
      employerId: payload.employerId,
      jti,
    },
    config.JWT_SECRET,
    {
      issuer: config.JWT_ISSUER,
      expiresIn: `${expiresInHours}h`,
    },
  );

  return { token, jti, expiresAt };
}

/** Verify and decode a JWT. Throws TokenError on expiry or tampering. */
export function verifyToken(token: string): VerificationTokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      issuer: config.JWT_ISSUER,
    }) as jwt.JwtPayload & VerificationTokenPayload;

    return {
      sessionId: decoded.sessionId,
      candidateEmail: decoded.candidateEmail,
      employerId: decoded.employerId,
      jti: decoded.jti,
    };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new TokenError('TOKEN_EXPIRED', 'Verification link has expired');
    }
    throw new TokenError('TOKEN_INVALID', 'Invalid verification link');
  }
}
