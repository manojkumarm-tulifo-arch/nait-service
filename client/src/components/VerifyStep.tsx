import { useState, useEffect, useCallback, useRef } from 'react';
import OtpInput from './OtpInput';
import * as api from '../api/verification';

interface VerifyStepProps {
  token: string;
  email: string;
  phone: string | null;
  onComplete: () => void;
}

export default function VerifyStep({ token, email, phone, onComplete }: VerifyStepProps) {
  const [phase, setPhase] = useState<'confirm' | 'otp'>('confirm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP state
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [verifying, setVerifying] = useState(false);

  // Track whether email/phone OTP auto-complete triggered verification
  const emailCodeRef = useRef('');
  const phoneCodeRef = useRef('');

  // Countdown timers
  useEffect(() => {
    if (emailTimer <= 0) return;
    const t = setTimeout(() => setEmailTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [emailTimer]);

  useEffect(() => {
    if (phoneTimer <= 0) return;
    const t = setTimeout(() => setPhoneTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phoneTimer]);

  const hasPhone = !!phone;
  const allVerified = emailVerified && (!hasPhone || phoneVerified);
  const canVerify = emailCode.length === 6 && (!hasPhone || phoneCode.length === 6);

  const handleSendCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const promises: Promise<unknown>[] = [api.sendOtp(token, email)];
      if (hasPhone) promises.push(api.sendPhoneOtp(token, phone));
      await Promise.all(promises);
      setPhase('otp');
      setEmailTimer(30);
      if (hasPhone) setPhoneTimer(30);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to send verification codes');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (emailTimer > 0 || emailVerified) return;
    setError(null);
    try {
      await api.sendOtp(token, email);
      setEmailTimer(30);
    } catch {
      setError('Failed to resend email code');
    }
  };

  const handleResendPhone = async () => {
    if (phoneTimer > 0 || phoneVerified || !hasPhone) return;
    setError(null);
    try {
      await api.sendPhoneOtp(token, phone);
      setPhoneTimer(30);
    } catch {
      setError('Failed to resend phone code');
    }
  };

  const handleVerifyAll = useCallback(async () => {
    if (verifying) return;
    setVerifying(true);
    setError(null);

    try {
      const promises: Promise<unknown>[] = [];

      if (!emailVerified && emailCodeRef.current.length === 6) {
        promises.push(
          api.verifyOtp(token, emailCodeRef.current).then(() => setEmailVerified(true)),
        );
      }

      if (hasPhone && !phoneVerified && phoneCodeRef.current.length === 6) {
        promises.push(
          api.verifyPhoneOtp(token, phoneCodeRef.current).then(() => setPhoneVerified(true)),
        );
      }

      await Promise.all(promises);
      // After verification, reload session to get updated state
      onComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [token, email, phone, hasPhone, emailVerified, phoneVerified, verifying, onComplete]);

  const handleEmailCodeComplete = (code: string) => {
    setEmailCode(code);
    emailCodeRef.current = code;
  };

  const handlePhoneCodeComplete = (code: string) => {
    setPhoneCode(code);
    phoneCodeRef.current = code;
  };

  // --- Phase 1: Confirm contact details ---
  if (phase === 'confirm') {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h2>
        <p className="text-gray-500 mb-8">Confirm your contact details to receive verification codes.</p>

        <div className="w-full max-w-sm">
          {/* Email display */}
          <div className="mb-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</p>
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-700">{email}</span>
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Pre-filled</span>
            </div>
          </div>

          {/* Phone display */}
          {hasPhone && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Phone</p>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="text-gray-700">{phone}</span>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Pre-filled</span>
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          <button
            onClick={handleSendCodes}
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>→</span> Send Verification Codes
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Codes expire in 10 minutes — do not share
        </p>
      </div>
    );
  }

  // --- Phase 2: Enter verification codes ---
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Verification Codes</h2>
      <p className="text-gray-500 mb-8">
        We sent 6-digit codes to {hasPhone ? 'both your email and phone.' : 'your email.'}
      </p>

      <div className="w-full max-w-sm space-y-4">
        {/* Email Code */}
        <div className={`border-2 rounded-2xl p-5 transition-colors ${emailVerified ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="font-semibold text-gray-900 flex items-center gap-2">
                Email Code
                {emailVerified && (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </p>
              <p className="text-sm text-gray-400">{email}</p>
            </div>
            {!emailVerified && (
              emailTimer > 0 ? (
                <span className="text-sm text-gray-400 font-medium">{emailTimer}s</span>
              ) : (
                <button onClick={handleResendEmail} className="text-sm text-indigo-600 font-medium hover:underline">
                  Resend
                </button>
              )
            )}
          </div>
          {!emailVerified && (
            <div className="mt-3">
              <OtpInput onComplete={handleEmailCodeComplete} />
            </div>
          )}
        </div>

        {/* Phone Code */}
        {hasPhone && (
          <div className={`border-2 rounded-2xl p-5 transition-colors ${phoneVerified ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-semibold text-gray-900 flex items-center gap-2">
                  Phone Code
                  {phoneVerified && (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </p>
                <p className="text-sm text-gray-400">{phone}</p>
              </div>
              {!phoneVerified && (
                phoneTimer > 0 ? (
                  <span className="text-sm text-gray-400 font-medium">{phoneTimer}s</span>
                ) : (
                  <button onClick={handleResendPhone} className="text-sm text-indigo-600 font-medium hover:underline">
                    Resend
                  </button>
                )
              )}
            </div>
            {!phoneVerified && (
              <div className="mt-3">
                <OtpInput onComplete={handlePhoneCodeComplete} />
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        {/* Verify & Continue button */}
        <button
          onClick={handleVerifyAll}
          disabled={verifying || !canVerify || allVerified}
          className={`w-full py-3.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
            canVerify && !allVerified
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {verifying ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verify & Continue
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Codes expire in 10 minutes — do not share
      </p>
    </div>
  );
}
