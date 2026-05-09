import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

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

type PopoverProps = {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  width?: number;
};

export function Popover({ open, anchor, onClose, children, width = 360 }: PopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'below' | 'above' } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }

    const compute = () => {
      const rect = anchor.getBoundingClientRect();
      const popoverHeight = ref.current?.offsetHeight ?? 220;
      const desiredLeft = rect.left + rect.width / 2 - width / 2;
      const left = Math.max(12, Math.min(desiredLeft, window.innerWidth - width - 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: 'below' | 'above' =
        spaceBelow >= popoverHeight + 12 || rect.top < popoverHeight + 12 ? 'below' : 'above';
      const top = placement === 'below' ? rect.bottom + 8 : Math.max(12, rect.top - popoverHeight - 8);
      setPosition({ top, left, placement });
    };

    compute();
    const raf = requestAnimationFrame(compute);

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleResize = () => compute();

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open, anchor, onClose, width]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      className={`popover ${position?.placement === 'above' ? 'popover-above' : 'popover-below'}`}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'low' | 'medium' | 'high' | 'accent' | 'neutral';
  size?: 'sm' | 'md';
  explanation?: ReactNode;
};

export function MetricCard({ label, value, hint, tone = 'neutral', size = 'md', explanation }: MetricCardProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className={`metric metric-${size} metric-${tone} ${explanation ? 'metric-explainable' : ''}`}>
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        {explanation && (
          <button
            ref={triggerRef}
            type="button"
            className={`metric-info ${open ? 'metric-info-active' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={`Explain ${label}`}
            aria-expanded={open}
          >
            <SvgIcon.Info />
          </button>
        )}
      </div>
      <strong className="metric-value">{value}</strong>
      {hint != null && <span className="metric-hint">{hint}</span>}
      {explanation && (
        <Popover open={open} anchor={triggerRef.current} onClose={() => setOpen(false)} width={380}>
          {explanation}
        </Popover>
      )}
    </div>
  );
}

type BarRowProps = {
  label: string;
  value: number;
  delta?: number;
  color: string;
  explanation?: ReactNode;
};

export function BarRow({ label, value, delta, color, explanation }: BarRowProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const sign = (delta ?? 0) > 0 ? '+' : '';

  return (
    <div className="bar-row">
      <span className="bar-label">
        <span className="bar-label-text">{label}</span>
        {explanation && (
          <button
            ref={triggerRef}
            type="button"
            className={`bar-info ${open ? 'bar-info-active' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={`Explain ${label}`}
          >
            <SvgIcon.Info />
          </button>
        )}
      </span>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
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
      {explanation && (
        <Popover open={open} anchor={triggerRef.current} onClose={() => setOpen(false)} width={380}>
          {explanation}
        </Popover>
      )}
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
  Chevron: ({ dir = 'left' }: { dir?: 'left' | 'right' | 'up' | 'down' }) => {
    const paths: Record<string, string> = {
      left: 'M15 6l-6 6 6 6',
      right: 'M9 6l6 6-6 6',
      up: 'M6 15l6-6 6 6',
      down: 'M6 9l6 6 6-6',
    };
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d={paths[dir]} />
      </svg>
    );
  },
  X: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  Info: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  ),
  Pause: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ),
  SkipBack: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M6 5h2v14H6zM9 12l9-7v14z" />
    </svg>
  ),
  SkipForward: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M18 5h-2v14h2zM15 12L6 5v14z" />
    </svg>
  ),
};
