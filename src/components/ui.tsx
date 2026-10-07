"use client";

import Link from "next/link";
import { Info, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { band, type Band } from "@/lib/mastery";
import { pct } from "@/lib/format";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  tone = "plain",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "plain" | "accent" | "good" | "mid" | "bad" | "sunken";
  id?: string;
}) {
  const tones = {
    plain: "ui-card-plain bg-surface border-line",
    sunken: "bg-sunken border-line",
    accent: "bg-accent-soft border-accent/30",
    good: "bg-good-soft border-good/30",
    mid: "bg-mid-soft border-mid/30",
    bad: "bg-bad-soft border-bad/30",
  } as const;
  return (
    <section id={id} className={cx("ui-card min-w-0 rounded-2xl border p-4 sm:p-5", tones[tone], className)}>
      {children}
    </section>
  );
}

/**
 * Card heading. `sub` is a short line of data that is always shown. `info` is the "how to read this" text,
 * folded behind a small button so the card stays quiet until you ask.
 */
export function CardTitle({ children, action, sub, info }: { children: ReactNode; action?: ReactNode; sub?: ReactNode; info?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const infoId = useId();
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="ui-card-title text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
          {info ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={infoId}
              aria-label="How to read this"
              className={cx("rounded-full p-0.5 transition-colors hover:text-accent", open ? "text-accent" : "text-ink-3")}
            >
              <Info size={15} aria-hidden />
            </button>
          ) : null}
        </div>
        {sub ? <p className="ui-card-sub mt-0.5 text-[13px] text-ink-3">{sub}</p> : null}
        {info && open ? (
          <p id={infoId} className="mt-1 max-w-prose text-[13px] text-ink-2">
            {info}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-pagehead mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="ui-h1 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {sub ? <p className="ui-h1-sub mt-1 text-sm text-ink-3">{sub}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "good";

const BUTTON_BASE =
  "ui-btn inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";
const BUTTON_VARIANT: Record<Variant, string> = {
  primary: "ui-btn-primary bg-accent text-on-accent hover:bg-accent-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "border border-bad/40 bg-bad-soft text-bad hover:border-bad",
  good: "border border-good/40 bg-good-soft text-good hover:border-good",
};
const BUTTON_SIZE = { sm: "h-8 px-2.5 text-[13px]", md: "h-10 px-3.5 text-sm" } as const;

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)} {...rest} />;
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Link href={href} className={cx(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}>
      {children}
    </Link>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "good" | "mid" | "bad";
  className?: string;
}) {
  const tones = {
    neutral: "bg-sunken text-ink-2 border-line",
    accent: "bg-accent-soft text-accent border-accent/25",
    good: "bg-good-soft text-good border-good/25",
    mid: "bg-mid-soft text-mid border-mid/25",
    bad: "bg-bad-soft text-bad border-bad/25",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const BAND_TONE: Record<Band, "neutral" | "good" | "mid" | "bad"> = {
  none: "neutral",
  low: "bad",
  mid: "mid",
  high: "good",
};

export const BAND_FILL: Record<Band, string> = {
  none: "var(--color-none)",
  low: "var(--color-cell-bad)",
  mid: "var(--color-cell-mid)",
  high: "var(--color-cell-good)",
};

export function MasteryBadge({ value }: { value: number | null }) {
  const b = band(value);
  return (
    <Badge tone={BAND_TONE[b]} className="tabular">
      {value == null ? "no data" : pct(value)}
    </Badge>
  );
}

export function ProgressBar({
  value,
  max = 1,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "accent" | "good" | "mid" | "bad";
  className?: string;
  label?: string;
}) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const fill = { accent: "bg-accent", good: "bg-good", mid: "bg-mid", bad: "bg-bad" }[tone];
  return (
    <div
      className={cx("h-2 w-full overflow-hidden rounded-full bg-sunken", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(w * 100)}
    >
      <div className={cx("h-full rounded-full transition-[width]", fill)} style={{ width: `${w * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "mid" | "bad" }) {
  const color = tone ? { good: "text-good", mid: "text-mid", bad: "text-bad" }[tone] : "text-ink";
  return (
    <div className="ui-stat rounded-2xl border border-line bg-surface p-4">
      <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
      <div className={cx("ui-stat-value tabular mt-1 text-2xl font-semibold tracking-tight", color)}>{value}</div>
      {sub ? <div className="ui-stat-sub mt-0.5 text-[13px] text-ink-3">{sub}</div> : null}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
      <div>{children}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-ink-3">{hint}</span> : null}
    </label>
  );
}

/** Input look without a width, for selects in filter rows. */
export const inputBase =
  "rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";
export const inputClass = `w-full ${inputBase}`;

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = "md",
  label,
}: {
  value: T | null;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-sunken p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-lg font-medium transition-colors",
              size === "sm" ? "px-2 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
              on ? "bg-surface text-ink shadow-sm ring-1 ring-line-strong" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-1.5rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open ? (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export function Dots({ value, max = 3, label }: { value: number; max?: number; label: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={label} title={label}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx("h-1.5 w-1.5 rounded-full", i < value ? "bg-accent" : "bg-line-strong")} />
      ))}
    </span>
  );
}
