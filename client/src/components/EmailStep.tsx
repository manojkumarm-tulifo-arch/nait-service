import { useState, useEffect, useCallback } from 'react';
import OtpInput from './OtpInput';
import * as api from '../api/verification';

interface EmailStepProps {
  token: string;
  email: string;
  onComplete: () => void;
}

export default function EmailStep({ token, email, onComplete }: EmailStepProps) {
  const [phase, setPhase] = useState<'input' | 'otp'>('input');
  const [emailValue, setEmailValue] = useState(email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.sendOtp(token, emailValue);
      setPhase('otp');
      setResendTimer(30);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        await api.verifyOtp(token, code);
        onComplete();
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
        setError(msg || 'Invalid OTP');
      } finally {
        setLoading(false);
      }
    },
    [token, onComplete],
  );

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(null);
    try {
      await api.sendOtp(token, emailValue);
      setResendTimer(30);
    } catch {
      setError('Failed to resend OTP');
    }
  };

  if (phase === 'input') {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
        <p className="text-gray-500 mb-8">Enter the email tied to your invitation link.</p>

        <div className="w-full max-w-sm">
          <input
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all mb-4"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={handleSendOtp}
            disabled={loading || !emailValue}
            className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>→</span> Continue
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Link tied to your email — cannot be forwarded
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Inbox</h2>
      <p className="text-gray-500 mb-8">
        We sent a 6-digit code to <strong>{emailValue}</strong>
      </p>

      <div className="w-full max-w-sm">
        <OtpInput onComplete={handleVerifyOtp} />

        {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}

        <button
          onClick={handleVerifyOtp.bind(null, '')}
          disabled={loading}
          className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-6 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verify Code
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-400 mt-4">
          {resendTimer > 0 ? (
            <>Resend in {resendTimer}s</>
          ) : (
            <button onClick={handleResend} className="text-indigo-600 hover:underline">
              Resend code
            </button>
          )}
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Link tied to your email — cannot be forwarded
      </p>
    </div>
  );
}
