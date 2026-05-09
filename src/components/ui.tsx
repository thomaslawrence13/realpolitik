import type { ReactNode } from 'react';

type TabsProps<T extends string> = {
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
};

export function Tabs<T extends string>({ value, options, onChange, size = 'md' }: TabsProps<T>) {
  return (
    <div className={`tabs tabs-${size}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`tab ${value === option.value ? 'tab-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {typeof option.count === 'number' && <em className="tab-count">{option.count}</em>}
        </button>
      ))}
    </div>
  );
}

type SegmentedProps<T extends string> = {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`segment ${value === option.value ? 'segment-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'low' | 'medium' | 'high' | 'accent' | 'neutral';
  size?: 'sm' | 'md';
};

export function MetricCard({ label, value, hint, tone = 'neutral', size = 'md' }: MetricCardProps) {
  return (
    <div className={`metric metric-${size} metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {hint != null && <span className="metric-hint">{hint}</span>}
    </div>
  );
}

type BarRowProps = {
  label: string;
  value: number;
  delta?: number;
  color: string;
};

export function BarRow({ label, value, delta, color }: BarRowProps) {
  const sign = (delta ?? 0) > 0 ? '+' : '';
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
      <strong className="bar-value">
        {value}%
        {typeof delta === 'number' && (
          <em className={`bar-delta ${delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}`}>
            {sign}
            {delta}
          </em>
        )}
      </strong>
    </div>
  );
}

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
};

export function Slider({ label, value, min, max, onChange, format }: SliderProps) {
  const display = format ? format(value) : value > 0 ? `+${value}` : `${value}`;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="slider">
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <strong className="slider-value">{display}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ['--slider-pct' as string]: `${pct}%` }}
      />
    </label>
  );
}

export function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'icon-btn-active' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export const SvgIcon = {
  PanelLeft: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  ),
  PanelRight: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </svg>
  ),
  PanelBottom: () => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 14h18" />
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14" />
    </svg>
  ),
  Reset: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  ),
  Chevron: ({ dir = 'left' }: { dir?: 'left' | 'right' }) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
};
