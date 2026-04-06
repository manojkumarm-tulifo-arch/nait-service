import { useRef, useState, useCallback } from 'react';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
}

export default function OtpInput({ length = 6, onComplete }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (idx: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const next = [...values];
      next[idx] = value;
      setValues(next);

      if (value && idx < length - 1) {
        inputsRef.current[idx + 1]?.focus();
      }

      if (next.every((v) => v !== '')) {
        onComplete(next.join(''));
      }
    },
    [values, length, onComplete],
  );

  const handleKeyDown = useCallback(
    (idx: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !values[idx] && idx > 0) {
        inputsRef.current[idx - 1]?.focus();
      }
    },
    [values],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;
      const next = [...values];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setValues(next);
      const focusIdx = Math.min(pasted.length, length - 1);
      inputsRef.current[focusIdx]?.focus();
      if (next.every((v) => v !== '')) onComplete(next.join(''));
    },
    [values, length, onComplete],
  );

  return (
    <div className="flex gap-3 justify-center">
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-12 h-14 text-center text-xl font-semibold border-2 border-gray-200 rounded-lg
                     focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
        />
      ))}
    </div>
  );
}
