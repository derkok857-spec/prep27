"use client";

import type { ReactNode } from "react";
import { fmtDay, type ISODate } from "@/lib/dates";
import { fmtHours, pct } from "@/lib/format";
import { band } from "@/lib/mastery";
import type { PlanWeek } from "@/lib/planner";
import type { ReadinessPoint, WeekAccuracy } from "@/lib/stats";
import type { WeekHours } from "@/lib/timelog";
import { BAND_FILL, cx } from "./ui";
import { useMeasure } from "./useMeasure";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const steps = [1, 2, 2.5, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const s of steps) if (s * mag >= v) return s * mag;
  return 10 * mag;
}

function ticks(max: number, n = 4): number[] {
  return Array.from({ length: n + 1 }, (_, i) => (max * i) / n);
}

export function WeeklyHoursChart({
  weeks,
  target,
  height = 220,
}: {
  weeks: WeekHours[];
  target: (start: ISODate) => number;
  height?: number;
}) {
  const [ref, W] = useMeasure<HTMLDivElement>();
  const H = height;
  const padL = 34;
  const padB = 24;
  const padT = 10;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const max = niceMax(Math.max(...weeks.map((w) => Math.max(w.total, target(w.start))), 1));
  const bw = innerW / Math.max(weeks.length, 1);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const every = Math.max(1, Math.ceil(weeks.length / Math.max(1, Math.floor(W / 80))));
  const label = `Weekly study hours for ${weeks.length} weeks`;
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute left-0 top-0 block" role="img" aria-label={label}>
        <title>{label}</title>
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = padL + i * bw + bw * 0.18;
          const bwi = bw * 0.64;
          let acc = 0;
          const segs: [number, string][] = [
            [w.learn, "var(--color-accent)"],
            [w.practice, "var(--color-cell-good)"],
            [w.review, "var(--color-cell-mid)"],
          ];
          const t = target(w.start);
          return (
            <g key={w.start}>
              <title>{`Week of ${fmtDay(w.start)}: ${fmtHours(w.total)} (learning ${fmtHours(w.learn)}, practice ${fmtHours(w.practice)}, review ${fmtHours(w.review)}), plan ${t} h`}</title>
              {segs.map(([v, c], k) => {
                const y0 = y(acc + v);
                const hgt = (v / max) * innerH;
                acc += v;
                return v > 0 ? (
                  <rect
                    key={k}
                    x={x}
                    y={y0}
                    width={bwi}
                    height={Math.max(hgt, 0.5)}
                    fill={c}
                    rx={k === 2 || (k === 1 && !w.review) ? 2 : 0}
                  />
                ) : null;
              })}
              <line
                x1={x - 2}
                x2={x + bwi + 2}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-ink)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.55"
              />
              {i % every === 0 ? (
                <text x={x + bwi / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
                  {fmtDay(w.start)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.line ? (
            <span className="h-0.5 w-4 rounded" style={{ background: i.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function AccuracyTrendChart({ data, height = 200 }: { data: WeekAccuracy[]; height?: number }) {
  const [ref, W] = useMeasure<HTMLDivElement>();
  const H = height;
  const padL = 40;
  const padB = 24;
  const padT = 10;
  const innerW = W - padL - 12;
  const innerH = H - padB - padT;
  const x = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - v * innerH;
  const pts = data.map((d, i) => ({ ...d, i, v: d.n > 0 ? d.c / d.n : null })).filter((d) => d.v != null) as (WeekAccuracy & {
    i: number;
    v: number;
  })[];
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(W / 80))));
  const label = "Weekly practice accuracy";
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute left-0 top-0 block" role="img" aria-label={label}>
        <title>{label}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 12} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - 12} y1={y(0.65)} y2={y(0.65)} stroke="var(--color-good)" strokeDasharray="4 4" opacity="0.8" />
        <line x1={padL} x2={W - 12} y1={y(0.55)} y2={y(0.55)} stroke="var(--color-bad)" strokeDasharray="4 4" opacity="0.6" />
        {pts.length > 1 ? (
          <polyline
            points={pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : null}
        {pts.map((p) => (
          <circle
            key={p.start}
            cx={x(p.i)}
            cy={y(p.v)}
            r={Math.min(8, 3 + Math.sqrt(p.n) / 2.5)}
            fill={BAND_FILL[band(p.v)]}
            stroke="var(--color-surface)"
            strokeWidth="1.5"
          >
            <title>{`Week of ${fmtDay(p.start)}: ${p.c}/${p.n}, ${pct(p.v)}`}</title>
          </circle>
        ))}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={d.start} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
              {fmtDay(d.start)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function ReadinessChart({ points, height = 180 }: { points: ReadinessPoint[]; height?: number }) {
  const [ref, W] = useMeasure<HTMLDivElement>();
  const H = height;
  const padL = 40;
  const padB = 24;
  const padT = 10;
  const innerW = W - padL - 12;
  const innerH = H - padB - padT;
  const peak = Math.max(...points.map((p) => p.value), 0.01) * 1.15;
  const max = [0.2, 0.4, 0.6, 0.8, 1].find((m) => m >= peak) ?? 1;
  const x = (i: number) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length ? `${x(0)},${y(0)} ${line} ${x(points.length - 1)},${y(0)}` : "";
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(W / 80))));
  const label = "Readiness at the end of each week";
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute left-0 top-0 block" role="img" aria-label={label}>
        <title>{label}</title>
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 12} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {area ? <polygon points={area} fill="var(--color-accent-soft)" /> : null}
        {points.length > 1 ? <polyline points={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" /> : null}
        {points.map((p, i) => (
          <circle key={p.day} cx={x(i)} cy={y(p.value)} r={3} fill="var(--color-accent)">
            <title>{`${fmtDay(p.day)}: ${pct(p.value, 1)}`}</title>
          </circle>
        ))}
        {points.map((p, i) =>
          i % every === 0 ? (
            <text key={`l${p.day}`} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
              {fmtDay(p.day)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function HBarList({
  rows,
  format = (v) => pct(v),
  colorBy = "band",
}: {
  rows: { key: string; label: ReactNode; value: number | null; sub?: string; max?: number }[];
  format?: (v: number) => string;
  colorBy?: "band" | "accent";
}) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const max = r.max ?? 1;
        const w = r.value == null ? 0 : Math.max(0, Math.min(1, r.value / max));
        const fill = colorBy === "band" ? BAND_FILL[band(r.value)] : "var(--color-accent)";
        return (
          <li
            key={r.key}
            className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
          >
            <span className="truncate text-ink-2">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full" style={{ width: `${w * 100}%`, background: fill }} />
            </span>
            <span className="tabular w-24 text-right text-[13px] text-ink-2">
              {r.value == null ? "–" : format(r.value)}
              {r.sub ? <span className="block text-[11px] text-ink-3">{r.sub}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const PHASE_FILL: Record<PlanWeek["phase"], string> = {
  past: "var(--color-line-strong)",
  content: "var(--color-accent)",
  buffer: "var(--color-cell-good)",
  mock: "var(--color-cell-mid)",
  exam: "var(--color-cell-bad)",
};

export function PlanBars({ weeks, weeklyHours, height = 170 }: { weeks: PlanWeek[]; weeklyHours: number; height?: number }) {
  const [ref, W] = useMeasure<HTMLDivElement>();
  const H = height;
  const padB = 22;
  const padT = 8;
  const padL = 30;
  const innerW = W - padL - 6;
  const innerH = H - padB - padT;
  const value = (w: PlanWeek) =>
    w.phase === "past"
      ? w.logged
      : w.isCurrent
        ? Math.max(w.planned + w.logged, w.logged)
        : w.planned || (w.phase === "buffer" ? w.capacity : 0);
  const max = niceMax(Math.max(weeklyHours * 1.2, ...weeks.map(value), 1));
  const bw = innerW / Math.max(1, weeks.length);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const every = Math.max(1, Math.ceil(weeks.length / Math.max(1, Math.floor(W / 80))));
  const label = "Hours per week across the whole plan";
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute left-0 top-0 block" role="img" aria-label={label}>
        <title>{label}</title>
        {ticks(max, 4).map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 6} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={padL - 5} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--color-ink-3)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = padL + i * bw + bw * 0.12;
          const bwi = bw * 0.76;
          const v = value(w);
          const h = (v / max) * innerH;
          const loggedH = (w.logged / max) * innerH;
          return (
            <g key={w.start}>
              <title>
                {`Week of ${fmtDay(w.start)} · ${w.phase}${w.mockIndex ? ` ${w.mockIndex}` : ""} · ${w.phase === "past" ? `${fmtHours(w.logged)} logged` : `${fmtHours(w.planned)} planned${w.logged ? `, ${fmtHours(w.logged)} logged` : ""}`}${w.note ? ` · ${w.note}` : ""}`}
              </title>
              <rect
                x={x}
                y={y(v)}
                width={bwi}
                height={Math.max(h, w.phase === "exam" ? 4 : 0)}
                rx={2}
                fill={PHASE_FILL[w.phase]}
                opacity={w.phase === "content" && !w.isCurrent ? 0.55 : 1}
              />
              {w.isCurrent && w.logged > 0 ? (
                <rect x={x} y={y(w.logged)} width={bwi} height={loggedH} rx={2} fill="var(--color-ink)" opacity="0.35" />
              ) : null}
              {w.isCurrent ? (
                <rect
                  x={x - 1.5}
                  y={padT}
                  width={bwi + 3}
                  height={innerH}
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeDasharray="3 3"
                  opacity="0.5"
                  rx={3}
                />
              ) : null}
              {i % every === 0 ? (
                <text x={x + bwi / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--color-ink-3)">
                  {fmtDay(w.start)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const PLAN_LEGEND = [
  { label: "Logged", color: "var(--color-line-strong)" },
  { label: "Content", color: "var(--color-accent)" },
  { label: "Buffer", color: "var(--color-cell-good)" },
  { label: "Mocks", color: "var(--color-cell-mid)" },
  { label: "Exam week", color: "var(--color-cell-bad)" },
];

export function Sparkbar({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <span className={cx("inline-flex h-5 items-end gap-0.5", className)} aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="w-1.5 rounded-sm bg-accent/70" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </span>
  );
}
