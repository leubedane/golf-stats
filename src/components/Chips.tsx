interface Props<T extends string> {
  options: readonly T[];
  value: T | undefined | null;
  onChange: (value: T | undefined) => void;
  label: (value: T) => string;
  /** Tapping the selected chip clears it. */
  optional?: boolean;
  columns?: number;
  ariaLabel?: string;
}

/** Large tap targets for choosing one value. */
export function Chips<T extends string>({ options, value, onChange, label, optional, columns, ariaLabel }: Props<T>) {
  return (
    <div
      className="chips"
      role="radiogroup"
      aria-label={ariaLabel}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={value === o ? 'selected' : ''}
          onClick={() => onChange(optional && value === o ? undefined : o)}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}
