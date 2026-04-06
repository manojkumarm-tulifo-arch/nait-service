import { useState, useRef, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import * as api from '../api/verification';

interface IdProofStepProps {
  token: string;
  onComplete: () => void;
}

const ID_TYPES = [
  { key: 'aadhaar', label: 'AADHAAR' },
  { key: 'pan', label: 'PAN' },
  { key: 'passport', label: 'PASSPORT' },
  { key: 'dl', label: 'DL' },
] as const;

type Phase = 'select' | 'camera' | 'extracting' | 'result';

export default function IdProofStep({ token, onComplete }: IdProofStepProps) {
  const { videoRef, active, start, stop, capture, error: camError } = useCamera();
  const [idType, setIdType] = useState<string>('aadhaar');
  const [phase, setPhase] = useState<Phase>('select');
  const [extractedName, setExtractedName] = useState<string | null>(null);
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCamera = () => {
    setPhase('camera');
  };

  // Start camera after phase changes so the video element is in the DOM
  useEffect(() => {
    if (phase === 'camera' && !active) {
      start();
    }
  }, [phase, active, start]);

  const processId = async (blob: Blob) => {
    setPreviewUrl(URL.createObjectURL(blob));
    setPhase('extracting');
    setLoading(true);
    setError(null);
    try {
      const result = await api.uploadIdProof(token, idType, blob);
      setExtractedName(result.extractedName);
      setFaceMatchScore(result.faceMatchScore);
      setPhase('result');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to process ID');
      setPreviewUrl(null);
      setPhase('select');
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = () => {
    const blob = capture();
    if (!blob) return;
    stop();
    processId(blob);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processId(file);
  };

  const handleRetake = () => {
    setExtractedName(null);
    setFaceMatchScore(null);
    setPreviewUrl(null);
    setPhase('select');
    setError(null);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.confirmIdProof(token);
      onComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to confirm ID');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Your ID</h2>
      <p className="text-gray-500 mb-6 text-center">Capture your government ID. We'll match it against your selfie.</p>

      {/* ID Type Tabs */}
      {phase !== 'result' && (
        <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-6">
          {ID_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setIdType(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                idType === t.key ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Select / Camera Phase */}
      {phase === 'select' && (
        <div className="w-full max-w-sm">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 flex flex-col items-center mb-4">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <button
              onClick={handleOpenCamera}
              className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Open Camera
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
          {camError && <p className="text-red-500 text-sm mb-3 text-center">{camError}</p>}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Camera not working? Upload ID image instead
          </button>
        </div>
      )}

      {/* Camera View */}
      {phase === 'camera' && (
        <div className="w-full max-w-sm">
          <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video mb-4">
            <video ref={videoRef} className={`w-full h-full object-cover ${active ? '' : 'hidden'}`} playsInline muted />
          </div>
          <button
            onClick={handleCapture}
            disabled={!active}
            className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Capture ID
          </button>
        </div>
      )}

      {/* Extracting */}
      {phase === 'extracting' && (
        <div className="w-full max-w-sm">
          {previewUrl && (
            <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video mb-4">
              <img src={previewUrl} alt="Captured ID" className="w-full h-full object-cover opacity-60" />
            </div>
          )}
          <div className="border-2 border-gray-100 rounded-xl p-8 flex flex-col items-center">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-semibold text-gray-800">Extracting details...</p>
            <p className="text-sm text-gray-400 mt-1">Reading name from ID</p>
          </div>
        </div>
      )}

      {/* Result */}
      {phase === 'result' && (
        <div className="w-full max-w-sm">
          {previewUrl && (
            <div className="bg-gray-900 rounded-2xl overflow-hidden aspect-video mb-4">
              <img src={previewUrl} alt="Captured ID" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="border-2 border-emerald-200 rounded-xl p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-600 text-sm font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ID Verified
              </span>
              {faceMatchScore !== null && (
                <span className="text-indigo-600 text-sm font-medium">{Math.round(faceMatchScore * 100)}% face match</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Full Name</p>
                <p className="text-xl font-bold text-gray-900">{extractedName}</p>
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retake
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Encrypted — used only for verification
      </p>
    </div>
  );
}
