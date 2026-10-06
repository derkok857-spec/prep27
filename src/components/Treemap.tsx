"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MODULES, TOPICS, getTopic, weightMid, type CurriculumModule, type Topic } from "@/lib/curriculum";
import { progressOf } from "@/lib/defaults";
import { fmtHours, pct } from "@/lib/format";
import { band, type ModuleMastery } from "@/lib/mastery";
import { squarify } from "@/lib/treemap";
import type { Dataset, Status } from "@/lib/types";
import { BAND_FILL } from "./ui";
import { useMeasure } from "./useMeasure";

export type ColorMode = "mastery" | "progress";

const STATUS_FILL: Record<Status, string> = {
  done: "var(--color-cell-good)",
  reading: "var(--color-accent)",
  todo: "var(--color-none)",
};

interface Tip {
  x: number;
  y: number;
  m: CurriculumModule;
}

export function Treemap({ ds, mm, color }: { ds: Dataset; mm: Map<number, ModuleMastery>; color: ColorMode }) {
  const router = useRouter();
  const [box, width] = useMeasure<HTMLDivElement>(900);
  const [tip, setTip] = useState<Tip | null>(null);

  const height = width < 640 ? Math.round(width * 1.45) : Math.round(Math.min(640, Math.max(400, width * 0.6)));

  const layout = useMemo(() => {
    const topics = squarify<Topic>(
      TOPICS.map((t) => ({ value: weightMid(t), data: t })),
      0,
      0,
      width,
      height,
    );
    return topics.map((tr) => {
      const head = tr.h > 40 ? 20 : 0;
      const pad = 2;
      const mods = squarify<CurriculumModule>(
        MODULES.filter((m) => m.topic === tr.data.id).map((m) => ({ value: Math.max(mm.get(m.id)?.hours ?? 0.3, 0.3), data: m })),
        tr.x + pad,
        tr.y + head + pad,
        Math.max(tr.w - 2 * pad, 1),
        Math.max(tr.h - head - 2 * pad, 1),
      );
      return { tr, head, mods };
    });
  }, [height, mm, width]);

  const grayCell = (m: CurriculumModule) =>
    color === "progress" ? progressOf(ds, m.id).status === "todo" : band(mm.get(m.id)?.mastery ?? null) === "none";

  const fillOf = (m: CurriculumModule) => {
    if (color === "progress") return STATUS_FILL[progressOf(ds, m.id).status];
    return BAND_FILL[band(mm.get(m.id)?.mastery ?? null)];
  };

  const tipModule = tip ? tip.m : null;
  const tipInfo = tipModule ? mm.get(tipModule.id) : null;
  const tipProgress = tipModule ? progressOf(ds, tipModule.id) : null;

  return (
    <div ref={box} className="relative w-full overflow-x-clip" style={{ height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute left-0 top-0 block"
        role="group"
        aria-label="Knowledge map of all 102 modules"
      >
        {layout.map(({ tr, head, mods }) => {
          const t = tr.data;
          return (
            <g key={t.id}>
              <rect x={tr.x} y={tr.y} width={tr.w} height={tr.h} fill="var(--color-sunken)" stroke="var(--color-canvas)" strokeWidth={3} />
              {head ? (
                <text x={tr.x + 6} y={tr.y + 14} fontSize="12" fontWeight="600" fill="var(--color-ink)">
                  {tr.w > 150 ? `${t.short} · ${t.weightMin}–${t.weightMax}%` : t.short}
                </text>
              ) : null}
              {mods.map((r) => {
                const m = r.data;
                const p = progressOf(ds, m.id);
                const label = `${getTopic(m.topic).short} LM${m.lm}, ${m.title}. Mastery ${pct(mm.get(m.id)?.mastery ?? null)}. Status ${p.status}.`;
                return (
                  <g
                    key={m.id}
                    role="link"
                    tabIndex={0}
                    aria-label={label}
                    className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[var(--color-ink)]"
                    onClick={() => router.push(`/modules/${m.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/modules/${m.id}`);
                      }
                    }}
                    onMouseMove={(e) => {
                      const rect = box.current?.getBoundingClientRect();
                      if (rect) setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, m });
                    }}
                    onMouseLeave={() => setTip(null)}
                    onFocus={() => setTip({ x: r.x + r.w / 2, y: r.y + r.h, m })}
                    onBlur={() => setTip(null)}
                  >
                    <rect
                      x={r.x + 1}
                      y={r.y + 1}
                      width={Math.max(r.w - 2, 0.5)}
                      height={Math.max(r.h - 2, 0.5)}
                      rx={4}
                      fill={fillOf(m)}
                      stroke={p.status === "reading" && color === "mastery" ? "var(--color-accent)" : "transparent"}
                      strokeWidth={2}
                      strokeDasharray={p.status === "reading" ? "4 3" : undefined}
                    />
                    {r.w > 34 && r.h > 18 ? (
                      <text
                        x={r.x + 6}
                        y={r.y + 15}
                        fontSize="11"
                        fontWeight="500"
                        fill={grayCell(m) ? "var(--color-ink-3)" : "#fff"}
                        pointerEvents="none"
                        style={grayCell(m) ? undefined : { textShadow: "0 1px 1px rgb(0 0 0 / 0.25)" }}
                      >
                        LM{m.lm}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && tipModule && tipInfo && tipProgress ? (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-xl border border-line bg-surface p-3 text-[13px] shadow-lg"
          style={{ left: Math.min(Math.max(tip.x + 12, 0), width - 264), top: Math.min(tip.y + 12, height - 10) }}
        >
          <p className="font-semibold text-ink">
            {getTopic(tipModule.topic).short} LM{tipModule.lm}
          </p>
          <p className="text-ink-2">{tipModule.title}</p>
          <p className="mt-1.5 text-ink-3">
            Mastery {pct(tipInfo.mastery)} ·{" "}
            {tipProgress.status === "done" ? "done" : tipProgress.status === "reading" ? "reading" : "to do"}
            {tipInfo.acc.rawN ? ` · ${tipInfo.acc.raw}/${tipInfo.acc.rawN} right` : ""} · {fmtHours(tipInfo.hours)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export const MASTERY_LEGEND = [
  { label: "Strong, 65% and up", color: "var(--color-cell-good)" },
  { label: "Getting there, 55 to 65%", color: "var(--color-cell-mid)" },
  { label: "Weak, under 55%", color: "var(--color-cell-bad)" },
  { label: "No evidence yet", color: "var(--color-none)" },
];

export const PROGRESS_LEGEND = [
  { label: "Done", color: "var(--color-cell-good)" },
  { label: "Reading", color: "var(--color-accent)" },
  { label: "To do", color: "var(--color-none)" },
];
