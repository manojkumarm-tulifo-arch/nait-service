/**
 * App — root component that routes between Admin and Candidate flows.
 *
 * Routing:
 *  - /admin  → AdminPage (session creation form)
 *  - /:token → 5-step candidate verification wizard
 *
 * The candidate flow loads session state from the backend and renders the
 * appropriate step component. Each step calls onComplete (which re-fetches
 * session state) to advance to the next step.
 *
 * On page refresh after a completed submission, the app reconstructs the
 * confirmation result from the session's `submission` data so the candidate
 * sees the ConfirmationStep instead of being sent back to ReviewStep.
 */

import { useState, useEffect, useCallback } from 'react';
import Stepper from './components/Stepper';
import VerifyStep from './components/VerifyStep';
import PhotoStep from './components/PhotoStep';
import IdProofStep from './components/IdProofStep';
import ScheduleStep from './components/ScheduleStep';
import ReviewStep from './components/ReviewStep';
import ConfirmationStep from './components/ConfirmationStep';
import AdminPage from './components/AdminPage';
import * as api from './api/verification';
import type { SessionState, SubmitResult } from './api/verification';

const STEP_ORDER = ['email', 'photo', 'id_proof', 'schedule', 'review'] as const;

/** Derive which steps are complete based on the session's current step index. */
function getCompletedSteps(session: SessionState): string[] {
  const completed: string[] = [];
  const idx = STEP_ORDER.indexOf(session.currentStep);
  for (let i = 0; i < idx; i++) completed.push(STEP_ORDER[i]);
  if (session.status === 'completed') completed.push(...STEP_ORDER);
  return completed;
}

function isAdminRoute(): boolean {
  return window.location.pathname === '/admin' || window.location.pathname === '/admin/';
}

function getToken(): string | null {
  if (isAdminRoute()) return null;
  const path = window.location.pathname;
  // URL format: /TOKEN or /:token
  const parts = path.split('/').filter(Boolean);
  return parts[0] || null;
}

export default function App() {
  const [admin] = useState(isAdminRoute);
  const [token] = useState(getToken);

  if (admin) return <AdminPage />;
  const [session, setSession] = useState<SessionState | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getSessionState(token);
      setSession(data);
      setError(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to load verification session');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-500">Please use the verification link sent to your email.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // If the session is already completed (e.g. page refresh after submission),
  // reconstruct the confirmation result from session data so we skip ReviewStep.
  const resolvedSubmitResult: api.SubmitResult | null = submitResult ?? (
    session.status === 'completed' && session.submission
      ? {
          referenceNumber: session.submission.referenceNumber,
          candidateName: session.candidateName,
          candidateEmail: session.candidateEmail ?? '',
          booking: session.booking ? { startTime: session.booking.startTime, endTime: session.booking.endTime } : null,
        }
      : null
  );

  const completedSteps = getCompletedSteps(session);
  const isCompleted = session.status === 'completed' || resolvedSubmitResult !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <span className="font-semibold text-gray-800">tulifo</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Stepper */}
        <Stepper
          currentStep={isCompleted ? 'review' : session.currentStep}
          completedSteps={isCompleted ? STEP_ORDER.slice() : completedSteps}
        />

        {/* Step content */}
        {isCompleted && resolvedSubmitResult ? (
          <ConfirmationStep result={resolvedSubmitResult} />
        ) : session.currentStep === 'email' ? (
          <VerifyStep token={token} email={session.candidateEmail} phone={session.candidatePhone} onComplete={loadSession} />
        ) : session.currentStep === 'photo' ? (
          <PhotoStep token={token} onComplete={loadSession} />
        ) : session.currentStep === 'id_proof' ? (
          <IdProofStep token={token} onComplete={loadSession} />
        ) : session.currentStep === 'schedule' ? (
          <ScheduleStep token={token} candidateName={session.candidateName} onComplete={loadSession} />
        ) : session.currentStep === 'review' ? (
          <ReviewStep token={token} session={session} onComplete={setSubmitResult} />
        ) : null}
      </main>
    </div>
  );
}
