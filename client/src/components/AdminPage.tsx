import { useState } from 'react';
import * as api from '../api/verification';
import type { CreateSessionInput, CreateSessionResult } from '../api/verification';

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const defaultStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
const defaultEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

export default function AdminPage() {
  const [form, setForm] = useState<CreateSessionInput>({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    jobId: '',
    jobTitle: '',
    employerId: '',
    schedulingWindowStart: defaultStart.toISOString(),
    schedulingWindowEnd: defaultEnd.toISOString(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateSessionResult | null>(null);

  const update = (field: keyof CreateSessionInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const input: CreateSessionInput = {
        ...form,
        candidatePhone: form.candidatePhone || undefined,
      };
      const data = await api.createSession(input);
      setResult(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (result?.verificationLink) {
      navigator.clipboard.writeText(result.verificationLink);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 py-4">
          <div className="max-w-2xl mx-auto px-4 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">N</span>
              </div>
              <span className="font-semibold text-gray-800">nait.tulifo</span>
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-12">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Sent</h2>
            <p className="text-gray-500 mb-6 text-center">Verification link has been generated for the candidate.</p>

            <div className="w-full bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Session ID</p>
              <p className="text-sm text-gray-700 font-mono mb-4">{result.sessionId}</p>
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Verification Link</p>
              <p className="text-sm text-indigo-600 break-all font-mono">{result.verificationLink}</p>
            </div>

            <div className="flex gap-3 w-full">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Link
              </button>
              <button
                onClick={() => { setResult(null); setForm((f) => ({ ...f, candidateName: '', candidateEmail: '', candidatePhone: '' })); }}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                New Invite
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">N</span>
            </div>
            <span className="font-semibold text-gray-800">nait.tulifo</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Candidate Information</h1>
            <p className="text-gray-500 text-sm text-center mt-1.5">
              Enter the candidate's contact details. At least one is<br />required to begin the verification process.
            </p>
          </div>

          {/* Candidate Contact Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Candidate Name
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  value={form.candidateName}
                  onChange={(e) => update('candidateName', e.target.value)}
                  placeholder="Rajesh Kumar"
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="email"
                  required
                  value={form.candidateEmail}
                  onChange={(e) => update('candidateEmail', e.target.value)}
                  placeholder="rajesh.kumar@techcorp.in"
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 uppercase">and / or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <input
                  type="tel"
                  value={form.candidatePhone}
                  onChange={(e) => update('candidatePhone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Job Details Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Job Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Job ID</label>
                <input
                  type="text"
                  required
                  value={form.jobId}
                  onChange={(e) => update('jobId', e.target.value)}
                  placeholder="JOB-001"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Employer ID</label>
                <input
                  type="text"
                  required
                  value={form.employerId}
                  onChange={(e) => update('employerId', e.target.value)}
                  placeholder="EMP-001"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Job Title</label>
              <input
                type="text"
                required
                value={form.jobTitle}
                onChange={(e) => update('jobTitle', e.target.value)}
                placeholder="Senior Software Engineer"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          </div>

          {/* Scheduling Window */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Scheduling Window</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Start</label>
                <input
                  type="datetime-local"
                  required
                  value={toDatetimeLocal(new Date(form.schedulingWindowStart))}
                  onChange={(e) => update('schedulingWindowStart', new Date(e.target.value).toISOString())}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">End</label>
                <input
                  type="datetime-local"
                  required
                  value={toDatetimeLocal(new Date(form.schedulingWindowEnd))}
                  onChange={(e) => update('schedulingWindowEnd', new Date(e.target.value).toISOString())}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !form.candidateEmail || !form.candidateName}
            className="w-full py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Begin Verification
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 mt-4 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Information is encrypted and used only for identity verification
          </p>
        </form>
      </main>
    </div>
  );
}
