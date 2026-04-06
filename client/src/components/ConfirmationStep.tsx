import type { SubmitResult } from '../api/verification';

interface ConfirmationStepProps {
  result: SubmitResult;
}

export default function ConfirmationStep({ result }: ConfirmationStepProps) {
  const firstName = result.candidateName.split(' ')[0];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set, {firstName}!</h2>
      <p className="text-gray-500 mb-8">Here's your interview confirmation</p>

      <div className="w-full max-w-md border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{result.candidateName}</p>
            <p className="text-sm text-gray-500">{result.candidateEmail}</p>
          </div>
        </div>

        <div className="text-gray-700 leading-relaxed">
          <p>
            <strong>{firstName}</strong>, thanks for submitting the details.
            {result.booking && (
              <> Your interview is scheduled on <strong>{formatDate(result.booking.startTime)}</strong> at{' '}
              <strong>{formatTime(result.booking.startTime)}</strong>.</>
            )}
          </p>
          <p className="mt-2">Looking forward to your interview.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-gray-500 text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        Ref #{result.referenceNumber}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Confirmation sent to <span className="text-indigo-600">{result.candidateEmail}</span>
      </p>
    </div>
  );
}
