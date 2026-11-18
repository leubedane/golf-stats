import { useEffect, useState } from 'react';
import { parseDecimal } from '../domain/numbers';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  integer?: boolean;
  /** Shown empty instead of 0. */
  blankZero?: boolean;
  className?: string;
}

/** Numeric text input that accepts a decimal comma and reports only valid numbers. */
export function NumberField({ value, onChange, label, integer, blankZero, className }: Props) {
  const format = (v: number) => (blankZero && v === 0 ? '' : String(v));
  const [text, setText] = useState(format(value));
  useEffect(() => {
    setText((current) => (parseDecimal(current) === value ? current : format(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      className={className}
      aria-label={label}
      inputMode={integer ? 'numeric' : 'decimal'}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseDecimal(e.target.value);
        if (!Number.isNaN(n) && (!integer || Number.isInteger(n))) onChange(n);
        else if (e.target.value.trim() === '') onChange(0);
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}
