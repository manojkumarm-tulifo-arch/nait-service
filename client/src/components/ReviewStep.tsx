import { useState, useMemo, type ReactNode } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';
import type { SessionState } from '../api/verification';
import * as api from '../api/verification';

interface ReviewStepProps {
  token: string;
  session: SessionState;
  onComplete: (result: api.SubmitResult) => void;
}

/**
 * Structured device fingerprint captured at submission time.
 * All fields are strings (even numeric ones) for consistent display and
 * lossless JSON serialization to the backend.
 */
interface DeviceDetails {
  browser: string;   // e.g., "Chrome", "Safari", "Firefox", "Edge"
  os: string;        // navigator.platform — e.g., "MacIntel", "Win32"
  screen: string;    // physical screen size — e.g., "1680x1050"
  timezone: string;  // IANA timezone name — e.g., "Asia/Calcutta"
  cores: string;     // logical CPU cores
  memory: string;    // approx device RAM — e.g., "4GB" (Chromium only)
  network: string;   // effective connection type — e.g., "4G" (Chromium only)
  touch: string;     // "Yes" / "No"
  dpr: string;       // devicePixelRatio — e.g., "2x"
}

/**
 * Collect a device fingerprint from the browser.
 *
 * Missing/unsupported fields fall back to "N/A" so the submit flow never
 * fails due to a non-standard API (e.g., navigator.deviceMemory and
 * navigator.connection only exist in Chromium-based browsers).
 *
 * Browser detection is order-sensitive: Edge and Opera UAs both contain
 * "Chrome", so they must be checked first.
 */
function collectDeviceDetails(): DeviceDetails {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  const os = navigator.platform || 'Unknown';
  const screen = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/A';
  const cores = navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'N/A';

  // deviceMemory and connection are non-standard (Chromium only) — type them inline
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const memory = memoryGb ? `${memoryGb}GB` : 'N/A';

  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const network = connection?.effectiveType ? connection.effectiveType.toUpperCase() : 'N/A';

  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 ? 'Yes' : 'No';
  const dpr = `${window.devicePixelRatio}x`;

  return { browser, os, screen, timezone, cores, memory, network, touch, dpr };
}

/** Single cell in the device details grid. Icon + uppercase label + value. */
function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 mb-1 text-gray-400">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-800 truncate" title={value}>{value}</p>
    </div>
  );
}

export default function ReviewStep({ token, session, onComplete }: ReviewStepProps) {
  const geo = useGeolocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceExpanded, setDeviceExpanded] = useState(true);

  const firstName = session.candidateName.split(' ')[0];

  // Browser capabilities don't change mid-session, so collect once on mount.
  const deviceDetails = useMemo(() => collectDeviceDetails(), []);

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
        // Serialize the full device fingerprint as JSON. Backend stores it
        // opaquely as a string; admin UI can JSON.parse it back to an object.
        deviceInfo: JSON.stringify(deviceDetails),
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
        {/* Photo & ID card */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-4 mb-4">
            {session.photo?.photoUrl ? (
              <img src={session.photo.photoUrl} alt="Selfie" className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200" />
            ) : (
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{session.candidateName}</p>
              <p className="text-sm text-gray-500">{session.candidateEmail}</p>
            </div>
          </div>
          {session.idProof?.imageUrl && (
            <div className="bg-gray-50 rounded-lg overflow-hidden mb-3">
              <img src={session.idProof.imageUrl} alt="ID Proof" className="w-full h-32 object-cover" />
            </div>
          )}
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

        {/* Device card — collapsible summary + 3x3 fingerprint grid */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setDeviceExpanded((v) => !v)}
            aria-expanded={deviceExpanded}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Device</p>
                <p className="text-sm font-semibold text-gray-800">
                  {deviceDetails.browser} · {deviceDetails.os}
                </p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${deviceExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {deviceExpanded && (
            <div className="border-t border-gray-100 p-4 grid grid-cols-3 gap-x-4 gap-y-5">
              <DetailItem
                label="Browser"
                value={deviceDetails.browser}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 9c-3 0-4.5-4-4.5-9S9 3 12 3s4.5 4 4.5 9-1.5 9-4.5 9zM3 12h18" />
                  </svg>
                }
              />
              <DetailItem
                label="OS"
                value={deviceDetails.os}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              <DetailItem
                label="Screen"
                value={deviceDetails.screen}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
                  </svg>
                }
              />
              <DetailItem
                label="Timezone"
                value={deviceDetails.timezone}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <DetailItem
                label="Cores"
                value={deviceDetails.cores}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                }
              />
              <DetailItem
                label="Memory"
                value={deviceDetails.memory}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10a1 1 0 001 1h14a1 1 0 001-1V7a1 1 0 00-1-1H5a1 1 0 00-1 1zM8 10v4m4-4v4m4-4v4" />
                  </svg>
                }
              />
              <DetailItem
                label="Network"
                value={deviceDetails.network}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M5.05 12.343a9.5 9.5 0 0113.9 0M2 9a13.5 13.5 0 0120 0M12 20h.01" />
                  </svg>
                }
              />
              <DetailItem
                label="Touch"
                value={deviceDetails.touch}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                }
              />
              <DetailItem
                label="DPR"
                value={deviceDetails.dpr}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              />
            </div>
          )}
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
