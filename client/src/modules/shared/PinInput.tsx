import { useRef } from 'react';

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  disabled?: boolean;
}

export default function PinInput({ value, onChange, length = 4, disabled }: PinInputProps) {
  const refs = useRef<HTMLInputElement[]>([]);

  const handleChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const digits = value.split('');
    digits[idx] = val.slice(-1);
    // pad
    while (digits.length < length) digits.push('');
    const next = digits.join('').slice(0, length);
    onChange(next);
    if (val && idx < length - 1) refs.current[idx + 1]?.focus();
  };

  const handleKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="pin-row">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { if (el) refs.current[i] = el; }}
          className="pdig"
          type="password"
          maxLength={1}
          inputMode="numeric"
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
        />
      ))}
    </div>
  );
}
