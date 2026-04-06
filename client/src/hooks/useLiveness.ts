import { useState, useRef, useCallback, useEffect } from 'react';
import * as faceapi from 'face-api.js';

type Challenge = 'blink' | 'smile';

export interface DebugInfo {
  ear: number;
  earBaseline: number;
  blinkThresholdClose: number;
  blinkThresholdReopen: number;
  blinkPhase: string;
  happyScore: number;
  faceDetected: boolean;
  smileFrames: number;
}

interface LivenessState {
  modelsLoaded: boolean;
  detecting: boolean;
  challenges: { blink: boolean; smile: boolean };
  currentChallenge: Challenge | null;
  score: number;
  passed: boolean;
  error: string | null;
  debug: DebugInfo | null;
}

const MODEL_URL = '/models';

// Blink detection
const EAR_BASELINE_FRAMES = 5;
const EAR_BLINK_DROP_RATIO = 0.82;       // EAR only needs to drop to 82% of baseline (~18% dip)
const EAR_BLINK_RECOVER_RATIO = 0.92;    // recover to 92% of baseline
const NO_FACE_BLINK_FRAMES = 2;          // consecutive "no face" frames also count as blink

// Smile detection
const SMILE_THRESHOLD = 0.45;
const SMILE_SUSTAINED_FRAMES = 2;

// All mutable tracking state lives here — never in React state
interface TrackingState {
  earBaseline: number[];
  earBaselineValue: number;
  blinkPhase: 'calibrating' | 'watching' | 'closed' | 'done';
  blinkDone: boolean;
  smileDone: boolean;
  smileFrameCount: number;
  noFaceFrames: number;
  minEarSeen: number;
  finalScore: number;
  running: boolean;
}

function createTrackingState(): TrackingState {
  return {
    earBaseline: [],
    earBaselineValue: 0,
    blinkPhase: 'calibrating',
    blinkDone: false,
    smileDone: false,
    smileFrameCount: 0,
    noFaceFrames: 0,
    minEarSeen: 1,
    finalScore: 0,
    running: false,
  };
}

export function useLiveness(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<LivenessState>({
    modelsLoaded: false,
    detecting: false,
    challenges: { blink: false, smile: false },
    currentChallenge: null,
    score: 0,
    passed: false,
    error: null,
    debug: null,
  });

  const trackRef = useRef<TrackingState>(createTrackingState());
  const rafRef = useRef<number | null>(null);

  const loadModels = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setState((s) => ({ ...s, modelsLoaded: true }));
    } catch {
      setState((s) => ({ ...s, error: 'Failed to load face detection models' }));
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const computeEAR = useCallback((landmarks: faceapi.FaceLandmarks68): number => {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const ear = (eye: faceapi.Point[]) => {
      const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
      const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
      const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
      if (h === 0) return 0.3;
      return (v1 + v2) / (2.0 * h);
    };

    return (ear(leftEye) + ear(rightEye)) / 2;
  }, []);

  // Single detection pass — called via requestAnimationFrame loop
  const detectFrame = useCallback(async () => {
    const t = trackRef.current;
    if (!t.running) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      // Schedule next frame
      rafRef.current = requestAnimationFrame(() => { detectFrame(); });
      return;
    }

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceExpressions();

    // After await, check if still running (could have been stopped)
    if (!t.running) return;

    if (!detection) {
      // No face detected — if we're watching for a blink, this could BE the blink
      // (closing eyes can cause face detection to fail momentarily)
      if (!t.blinkDone && t.blinkPhase === 'watching') {
        t.noFaceFrames++;
        console.log('[liveness] No face frame #' + t.noFaceFrames + ' (blink via face-loss?)');
        if (t.noFaceFrames >= NO_FACE_BLINK_FRAMES) {
          // Treat consecutive face-loss as eyes closed
          t.blinkPhase = 'closed';
          console.log('[liveness] Face lost for ' + t.noFaceFrames + ' frames — treating as eyes closed');
        }
      }
      setState((prev) => ({
        ...prev,
        debug: {
          ear: 0, earBaseline: t.earBaselineValue,
          blinkThresholdClose: t.earBaselineValue * EAR_BLINK_DROP_RATIO,
          blinkThresholdReopen: t.earBaselineValue * EAR_BLINK_RECOVER_RATIO,
          blinkPhase: t.blinkPhase, happyScore: 0, faceDetected: false, smileFrames: t.smileFrameCount,
        },
      }));
      rafRef.current = requestAnimationFrame(() => { detectFrame(); });
      return;
    }

    // Face detected again — reset no-face counter
    if (t.noFaceFrames > 0) {
      console.log('[liveness] Face re-detected after ' + t.noFaceFrames + ' lost frames');
      t.noFaceFrames = 0;
    }

    const ear = computeEAR(detection.landmarks);
    const happyScore = detection.expressions.happy;

    // ─── Blink Detection ───────────────────────────────────
    if (!t.blinkDone) {
      if (t.blinkPhase === 'calibrating') {
        t.earBaseline.push(ear);
        if (t.earBaseline.length >= EAR_BASELINE_FRAMES) {
          t.earBaselineValue = t.earBaseline.reduce((a, b) => a + b, 0) / t.earBaseline.length;
          t.blinkPhase = 'watching';
          console.log('[liveness] Baseline calibrated:', t.earBaselineValue.toFixed(3),
            '| Close threshold:', (t.earBaselineValue * EAR_BLINK_DROP_RATIO).toFixed(3),
            '| Reopen threshold:', (t.earBaselineValue * EAR_BLINK_RECOVER_RATIO).toFixed(3));
        }
      } else if (t.blinkPhase === 'watching') {
        const closeThreshold = t.earBaselineValue * EAR_BLINK_DROP_RATIO;
        if (ear < closeThreshold) {
          t.blinkPhase = 'closed';
          console.log('[liveness] Eyes closed detected, EAR:', ear.toFixed(3), '< threshold:', closeThreshold.toFixed(3));
        }
      } else if (t.blinkPhase === 'closed') {
        const reopenThreshold = t.earBaselineValue * EAR_BLINK_RECOVER_RATIO;
        if (ear >= reopenThreshold) {
          t.blinkDone = true;
          t.blinkPhase = 'done';
          console.log('[liveness] Blink completed! EAR recovered to:', ear.toFixed(3));
        }
      }
    }

    // ─── Smile Detection ───────────────────────────────────
    if (t.blinkDone && !t.smileDone) {
      if (happyScore >= SMILE_THRESHOLD) {
        t.smileFrameCount++;
        if (t.smileFrameCount >= SMILE_SUSTAINED_FRAMES) {
          t.smileDone = true;
          t.running = false;
          t.finalScore = Math.round(((detection.detection.score + Math.min(happyScore, 1)) / 2) * 100) / 100;
          console.log('[liveness] Smile completed! Score:', happyScore.toFixed(2), '| Final:', t.finalScore);
        }
      } else {
        t.smileFrameCount = 0;
      }
    }

    // ─── Sync all state to React in ONE setState call ─────
    setState({
      modelsLoaded: true,
      detecting: t.running,
      challenges: { blink: t.blinkDone, smile: t.smileDone },
      currentChallenge: t.smileDone ? null : t.blinkDone ? 'smile' : 'blink',
      score: t.finalScore,
      passed: t.blinkDone && t.smileDone,
      error: null,
      debug: {
        ear: Math.round(ear * 1000) / 1000,
        earBaseline: Math.round(t.earBaselineValue * 1000) / 1000,
        blinkThresholdClose: Math.round(t.earBaselineValue * EAR_BLINK_DROP_RATIO * 1000) / 1000,
        blinkThresholdReopen: Math.round(t.earBaselineValue * EAR_BLINK_RECOVER_RATIO * 1000) / 1000,
        blinkPhase: t.blinkPhase,
        happyScore: Math.round(happyScore * 100) / 100,
        faceDetected: true,
        smileFrames: t.smileFrameCount,
      },
    });

    // Schedule next frame only if still running
    if (t.running) {
      rafRef.current = requestAnimationFrame(() => { detectFrame(); });
    }
  }, [videoRef, computeEAR]);

  const startDetection = useCallback(() => {
    if (!state.modelsLoaded) return;

    // Reset tracking
    trackRef.current = createTrackingState();
    trackRef.current.running = true;

    console.log('[liveness] Detection started');

    setState((s) => ({
      ...s,
      detecting: true,
      currentChallenge: 'blink',
      challenges: { blink: false, smile: false },
      passed: false,
      score: 0,
      debug: null,
    }));

    // Start detection loop
    rafRef.current = requestAnimationFrame(() => { detectFrame(); });
  }, [state.modelsLoaded, detectFrame]);

  const stopDetection = useCallback(() => {
    trackRef.current.running = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setState((s) => ({ ...s, detecting: false, currentChallenge: null }));
  }, []);

  useEffect(() => {
    return () => {
      trackRef.current.running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { ...state, startDetection, stopDetection };
}
