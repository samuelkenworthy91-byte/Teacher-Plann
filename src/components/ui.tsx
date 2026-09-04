import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

export function Logo({ dark = false, size = 34 }: { dark?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* Matches the app icon: paper tile, marker-stroke M, pen tick */}
      <span
        className="grid place-items-center rounded-[28%]"
        style={{
          width: size,
          height: size,
          background: "var(--color-cream)",
          border: dark ? "1px solid rgba(244,239,228,0.18)" : "1px solid var(--color-line)",
          boxShadow: "0 6px 16px -8px rgba(33,29,23,.45)",
        }}
      >
        <svg width={size * 0.74} height={size * 0.74} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6.2 15.4V8.2l5.8 4.4 5.8-4.4v7.2"
            stroke="var(--color-ink)"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.4 18.1l4.9 1.5 6.7-2.1"
            stroke="var(--color-pen)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className="font-display text-[1.3rem] font-semibold tracking-tight"
        style={{ color: dark ? "var(--color-cream)" : "var(--color-ink)" }}
      >
        MarkFlow
      </span>
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: "1em", height: "1em" }}
      aria-label="Loading"
    />
  );
}

export function ProgressRing({
  size = 120,
  stroke = 10,
  progress,
  color = "var(--color-pen)",
  track = "rgba(33,29,23,0.09)",
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset .6s cubic-bezier(.22,.8,.35,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white/50 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pen-soft text-pen">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{body}</p>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`pop card w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6`}
        role="dialog"
        aria-modal
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="btn btn-quiet -mr-2 -mt-1 !p-2"
            aria-label="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SegBar({
  segments,
  height = 8,
}: {
  segments: { color: string; value: number }[];
  height?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-ink/8"
      style={{ height }}
      role="presentation"
    >
      {segments.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${(s.value / total) * 100}%`,
            background: s.color,
            transition: "width .5s cubic-bezier(.22,.8,.35,1)",
          }}
        />
      ))}
    </div>
  );
}

export function styleDelay(i: number): CSSProperties {
  return { animationDelay: `${i * 60}ms` };
}
