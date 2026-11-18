import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { IconClose } from './icons';
import { signedPct } from '../lib/format';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

export function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div className="card-action">{action}</div> : null}
    </div>
  );
}

export type Tone = 'accent' | 'teal' | 'amber' | 'rose' | 'violet' | 'blue' | 'neutral';

export function StatCard({
  label,
  value,
  icon,
  delta,
  hint,
  tone = 'accent',
}: {
  label: string;
  value: string;
  icon: ReactNode;
  delta?: number | null;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {delta !== undefined ? (
          <span className={`delta ${delta !== null && delta < 0 ? 'down' : 'up'}`}>
            {signedPct(delta)}
          </span>
        ) : null}
        {hint ? <span className="muted">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone | 'success' | 'danger' | 'info' | 'warn';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function statusTone(status: string): Tone | 'success' | 'danger' | 'info' | 'warn' {
  const value = status.toLowerCase();
  if (value === 'available' || value === 'completed' || value === 'add' || value === 'low')
    return 'success';
  if (value === 'rented' || value === 'active' || value === 'medium') return 'info';
  if (value === 'maintenance' || value === 'overdue' || value === 'reduce') return 'danger';
  if (value === 'high') return 'warn';
  if (value === 'cancelled') return 'neutral';
  return 'neutral';
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge tone={statusTone(status)}>{label}</Badge>;
}

export function Progress({
  value,
  tone,
}: {
  value: number;
  tone?: 'accent' | 'teal' | 'amber' | 'rose';
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const auto = clamped >= 0.8 ? 'accent' : clamped >= 0.55 ? 'teal' : 'amber';
  return (
    <div className="progress">
      <span
        className={`progress-fill progress-${tone ?? auto}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; hint?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={value === tab.id ? 'tab active' : 'tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.hint ? <span>{tab.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Loader({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="loader">
      <span className="spinner" />
      <span>{label}…</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state-error">
      <strong>Couldn't load this view</strong>
      <p>{message}</p>
      <p className="muted">
        Make sure the API is running on port 4000, then retry.
      </p>
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state">
      <strong>{title}</strong>
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
