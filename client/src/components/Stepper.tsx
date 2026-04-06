const STEPS = [
  { key: 'email', label: 'Verify', icon: '✉' },
  { key: 'photo', label: 'Photo', icon: '📷' },
  { key: 'id_proof', label: 'ID Proof', icon: '🪪' },
  { key: 'schedule', label: 'Schedule', icon: '📅' },
  { key: 'review', label: 'Review', icon: '✓' },
] as const;

const STEP_ORDER = STEPS.map((s) => s.key);

interface StepperProps {
  currentStep: string;
  completedSteps: string[];
}

export default function Stepper({ currentStep, completedSteps }: StepperProps) {
  const currentIdx = STEP_ORDER.indexOf(currentStep as typeof STEP_ORDER[number]);

  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-10">
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.includes(step.key);
        const isCurrent = step.key === currentStep;
        const isPast = i < currentIdx;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  isCompleted || isPast
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isCompleted || isPast ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span>{step.icon}</span>
                )}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium ${
                  isCurrent ? 'text-indigo-600' : isCompleted || isPast ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-18px] ${
                  isPast || isCompleted ? 'bg-emerald-400' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
