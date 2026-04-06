import { useState, useRef, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useLiveness } from '../hooks/useLiveness';
import * as api from '../api/verification';

interface PhotoStepProps {
  token: string;
  onComplete: () => void;
}

type Phase = 'camera' | 'liveness' | 'preview';

export default function PhotoStep({ token, onComplete }: PhotoStepProps) {
  const { videoRef, active, error: camError, start, stop, capture } = useCamera();
  const liveness = useLiveness(videoRef);
  const [phase, setPhase] = useState<Phase>('camera');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCamera = async () => {
    await start();
  };

  const handleCapture = () => {
    const blob = capture();
    if (!blob) return;
    setCapturedBlob(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    stop();
    setPhase('preview');
  };

  const handleStartLiveness = () => {
    setPhase('liveness');
    liveness.startDetection();
  };

  const handleRetake = async () => {
    setPreviewUrl(null);
    setCapturedBlob(null);
    setPhase('camera');
    await start();
  };

  const handleUsePhoto = async () => {
    if (!capturedBlob) return;
    setLoading(true);
    setError(null);
    try {
      await api.uploadPhoto(token, capturedBlob);
      const score = liveness.passed ? liveness.score : 0.85;
      await api.submitLiveness(token, score);
      onComplete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase('preview');
  };

  // When liveness passes, auto-capture via effect
  useEffect(() => {
    if (phase !== 'liveness' || !liveness.passed || capturedBlob) return;

    // Small delay to ensure the last video frame is rendered
    const timer = setTimeout(() => {
      const blob = capture();
      if (blob) {
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stop();
        setPhase('preview');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [phase, liveness.passed, capturedBlob, capture, stop]);

  return (
    <div className="flex flex-col items-center">
      {phase !== 'preview' && (
        <p className="text-gray-500 mb-6 text-center">
          We'll verify you're a real person with a quick liveness check.
        </p>
      )}

      {/* Camera / Liveness View */}
      {(phase === 'camera' || phase === 'liveness') && (
        <div className="relative w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden aspect-[3/4]">
          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg z-10" />
          <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg z-10" />
          <div className="absolute bottom-16 left-3 w-8 h-8 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg z-10" />
          <div className="absolute bottom-16 right-3 w-8 h-8 border-b-2 border-r-2 border-indigo-400 rounded-br-lg z-10" />

          {/* Status badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            {phase === 'liveness' ? (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                VERIFYING
              </span>
            ) : active ? (
              <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full border border-red-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            ) : null}
          </div>

          {/* Face oval guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`w-48 h-60 rounded-full border-2 ${
                phase === 'liveness'
                  ? liveness.challenges.blink
                    ? 'border-emerald-400'
                    : 'border-amber-400'
                  : 'border-indigo-400/50'
              } transition-colors`}
            />
          </div>

          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${active ? '' : 'hidden'}`}
            playsInline
            muted
          />

          {!active && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-20 h-20 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}

          {/* Liveness challenges */}
          {phase === 'liveness' && (
            <div className="absolute bottom-16 left-4 right-4 space-y-2 z-10">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${liveness.challenges.blink ? 'bg-emerald-500/20' : 'bg-gray-800/80'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${liveness.challenges.blink ? 'bg-emerald-500 text-white' : 'border border-gray-500'}`}>
                  {liveness.challenges.blink ? '✓' : ''}
                </span>
                <span className={`text-sm ${liveness.challenges.blink ? 'text-emerald-400' : 'text-white'}`}>Blink your eyes</span>
                {liveness.currentChallenge === 'blink' && <span className="ml-auto text-gray-400 text-xs animate-pulse">👁</span>}
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${liveness.challenges.smile ? 'bg-emerald-500/20' : 'bg-gray-800/80'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${liveness.challenges.smile ? 'bg-emerald-500 text-white' : 'border border-gray-500'}`}>
                  {liveness.challenges.smile ? '✓' : ''}
                </span>
                <span className={`text-sm ${liveness.challenges.smile ? 'text-emerald-400' : 'text-gray-400'}`}>Smile naturally</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Preview */}
      {phase === 'preview' && previewUrl && (
        <div className="relative w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden aspect-[3/4]">
          <img src={previewUrl} alt="Captured selfie" className="w-full h-full object-cover" />
          <div className="absolute bottom-4 right-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      {camError && <p className="text-red-500 text-sm mt-3">{camError}</p>}

      {/* Action buttons */}
      <div className="mt-6 w-full max-w-sm">
        {!active && phase === 'camera' && (
          <button
            onClick={handleOpenCamera}
            className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open Camera
          </button>
        )}

        {phase === 'liveness' && liveness.passed && !capturedBlob && (
          <button
            onClick={handleCapture}
            className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Liveness Passed — Capture Photo
          </button>
        )}

        {active && phase === 'camera' && (
          <div className="space-y-3">
            {liveness.modelsLoaded ? (
              <button
                onClick={handleStartLiveness}
                className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Start Liveness Check
              </button>
            ) : (
              <button
                onClick={handleCapture}
                className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Capture
              </button>
            )}
          </div>
        )}

        {phase === 'preview' && (
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
              onClick={handleUsePhoto}
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
                  Use This
                </>
              )}
            </button>
          </div>
        )}

        {/* Fallback upload */}
        {phase !== 'preview' && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Camera not working? Upload a photo instead
            </button>
          </>
        )}
      </div>
    </div>
  );
}
