import { useState, useMemo } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import type { SessionState } from '../api/verification';
import * as api from '../api/verification';

interface ReviewStepProps {
  token: string;
  session: SessionState;
  onComplete: (result: api.SubmitResult) => void;
}

export default function ReviewStep({ token, session, onComplete }: ReviewStepProps) {
  const geo = useGeolocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = session.candidateName.split(' ')[0];

  const deviceInfo = useMemo(() => {
    const ua = navigator.userAgent;
    const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Browser';
    const platform = navigator.platform || 'Unknown';
    return `${browser} · ${platform}`;
  }, []);

  const formatBookingDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatBookingTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleSubmit = async () => {
    if (!geo.position) {
      geo.request();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.submitVerification(token, {
        latitude: geo.position.latitude,
        longitude: geo.position.longitude,
        accuracy: geo.position.accuracy,
        deviceInfo,
      });
      onComplete(result);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost there, {firstName}</h2>
      <p className="text-gray-500 mb-8">Review everything. Click any card to make changes.</p>

      <div className="w-full max-w-md space-y-4">
        {/* Candidate card */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{session.candidateName}</p>
              <p className="text-sm text-gray-500">{session.candidateEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Email
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Photo
            </span>
            <span className="flex items-center gap-1 text-emerald-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              ID
            </span>
            {session.idProof?.faceMatchScore && (
              <span className="ml-auto text-indigo-600 font-medium">
                {Math.round(session.idProof.faceMatchScore * 100)}% match
              </span>
            )}
          </div>
        </div>

        {/* Interview card */}
        {session.booking && (
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Interview</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{formatBookingDate(session.booking.startTime)}</p>
                <p className="text-sm text-gray-500">{formatBookingTime(session.booking.startTime)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Location card */}
        <div className={`border rounded-xl p-4 ${geo.position ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-300 bg-amber-50/50'}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Location</p>
            {!geo.position && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">REQUIRED</span>
            )}
          </div>
          {geo.position ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Location granted
            </div>
          ) : (
            <>
              <p className="text-sm text-amber-700 mb-2">Location access required to submit</p>
              <button
                onClick={geo.request}
                disabled={geo.loading}
                className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Grant Access
              </button>
              {geo.error && <p className="text-red-500 text-xs mt-1">{geo.error}</p>}
            </>
          )}
        </div>

        {/* Device card */}
        <div className="border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Device</p>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {deviceInfo}
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full max-w-md mt-6 py-3.5 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
          geo.position
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-100 text-gray-500'
        } disabled:opacity-50`}
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : geo.position ? (
          <>Submit Verification</>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Grant Location to Submit
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 mt-3 text-center">
        {geo.position ? 'By submitting you confirm accuracy of all details' : 'Location access is required to proceed'}
      </p>
    </div>
  );
}
