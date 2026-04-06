import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from './token.service.js';

const testPayload = {
  sessionId: '507f1f77bcf86cd799439011',
  candidateEmail: 'candidate@example.com',
  employerId: 'employer-123',
};

describe('Token Service', () => {
  describe('generateToken', () => {
    it('should generate a valid token with jti and expiresAt', () => {
      const result = generateToken(testPayload, 72);

      expect(result.token).toBeDefined();
      expect(result.jti).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate unique jti for each call', () => {
      const result1 = generateToken(testPayload, 72);
      const result2 = generateToken(testPayload, 72);

      expect(result1.jti).not.toBe(result2.jti);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return the payload', () => {
      const { token, jti } = generateToken(testPayload, 72);
      const decoded = verifyToken(token);

      expect(decoded.sessionId).toBe(testPayload.sessionId);
      expect(decoded.candidateEmail).toBe(testPayload.candidateEmail);
      expect(decoded.employerId).toBe(testPayload.employerId);
      expect(decoded.jti).toBe(jti);
    });

    it('should throw TOKEN_EXPIRED for expired tokens', () => {
      const token = jwt.sign(
        { ...testPayload, jti: 'test-jti' },
        process.env.JWT_SECRET!,
        { issuer: process.env.JWT_ISSUER!, expiresIn: '0s' },
      );

      expect(() => verifyToken(token)).toThrow('Verification link has expired');
    });

    it('should throw TOKEN_INVALID for tampered tokens', () => {
      const { token } = generateToken(testPayload, 72);
      const tampered = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tampered)).toThrow('Invalid verification link');
    });

    it('should throw TOKEN_INVALID for tokens signed with wrong secret', () => {
      const token = jwt.sign(
        { ...testPayload, jti: 'test-jti' },
        'wrong-secret-that-is-at-least-32-chars',
        { issuer: process.env.JWT_ISSUER! },
      );

      expect(() => verifyToken(token)).toThrow('Invalid verification link');
    });
  });
});
