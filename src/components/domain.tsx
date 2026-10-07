"use client";

import Link from "next/link";
import { CircleAlert, Info, Sparkles, TriangleAlert } from "lucide-react";
import { MODULES, TOPICS, getModule, getTopic, moduleLabel } from "@/lib/curriculum";
import { fmtTimestamp } from "@/lib/format";
import type { Insight } from "@/lib/insights";
import type { AiBatch } from "@/lib/types";
import { cx, inputClass } from "./ui";

export function ModuleSelect({
  value,
  onChange,
  allowNone = false,
  noneLabel = "No specific module",
  id,
  className,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      className={cx(inputClass, className)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      {allowNone ? <option value="">{noneLabel}</option> : null}
      {TOPICS.map((t) => (
        <optgroup key={t.id} label={t.name}>
          {MODULES.filter((m) => m.topic === t.id).map((m) => (
            <option key={m.id} value={m.id}>
              {`${t.short} LM${m.lm} · ${m.title}`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function ModuleLink({ id, full = false, className }: { id: number; full?: boolean; className?: string }) {
  const m = getModule(id);
  if (!m) return null;
  return (
    <Link href={`/modules/${id}`} className={cx("font-medium text-ink hover:text-accent hover:underline", className)}>
      {full ? (
        <>
          <span className="text-ink-3">{moduleLabel(id)}</span> {m.title}
        </>
      ) : (
        moduleLabel(id)
      )}
    </Link>
  );
}

export function moduleTitle(id: number): string {
  return getModule(id)?.title ?? `Module ${id}`;
}

export function topicName(id: number): string {
  const m = getModule(id);
  return m ? getTopic(m.topic).name : "";
}

const SEVERITY_STYLE = {
  alert: { icon: CircleAlert, cls: "border-bad", iconCls: "text-bad" },
  warn: { icon: TriangleAlert, cls: "border-mid", iconCls: "text-mid" },
  info: { icon: Info, cls: "border-accent", iconCls: "text-accent" },
} as const;

export function InsightList({ items, limit }: { items: Insight[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-4">
      {list.map((i) => {
        const s = SEVERITY_STYLE[i.severity];
        const Icon = s.icon;
        return (
          <li key={i.id} className={cx("border-l-[3px] py-0.5 pl-3.5", s.cls)}>
            <div className="flex gap-2">
              <Icon size={16} className={cx("mt-[3px] shrink-0", s.iconCls)} aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink">{i.title}</p>
                <p className="mt-0.5 text-ink-2">{i.action}</p>
                <details className="group mt-1.5 text-[13px]">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-ink-3 [&::-webkit-details-marker]:hidden">
                    <span className="font-medium text-accent group-open:hidden">Why</span>
                    <span className="hidden font-medium text-accent group-open:inline">Hide</span>
                    {i.modules.map((m) => (
                      <ModuleLink key={m} id={m} className="text-ink-2" />
                    ))}
                    {i.href ? (
                      <Link href={i.href} className="font-medium text-accent hover:underline">
                        Open
                      </Link>
                    ) : null}
                  </summary>
                  <p className="mt-1 text-ink-2">{i.detail}</p>
                </details>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function latestBatch(batches: AiBatch[]): AiBatch | null {
  if (!batches.length) return null;
  return [...batches].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export function CoachNote({ batch, compact = false }: { batch: AiBatch | null; compact?: boolean }) {
  if (!batch) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-3 text-sm text-ink-3">
        Your first coach note arrives after the Sunday AI run.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-accent/25 bg-accent-soft p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-accent">
        <Sparkles size={14} aria-hidden /> Coach note · {fmtTimestamp(batch.createdAt)}
      </div>
      <p className={cx("text-sm text-ink", compact && "line-clamp-4")}>{batch.summary}</p>
    </div>
  );
}

export function PatternList({ batch, knownMistakes }: { batch: AiBatch | null; knownMistakes: Set<string> }) {
  if (!batch || !batch.patterns.length) {
    return (
      <p className="text-sm text-ink-3">
        {batch
          ? "The last AI run found no clear pattern. It needs a few more logged mistakes."
          : "AI patterns arrive with the first weekly run."}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {batch.patterns.map((p, i) => {
        const ev = p.evidence.filter((id) => knownMistakes.has(id)).length;
        return (
          <li key={i} className="border-l-[3px] border-accent py-0.5 pl-3.5 text-sm">
            <p className="font-semibold text-ink">{p.title}</p>
            <p className="mt-0.5 text-ink-2">{p.action}</p>
            <details className="group mt-1.5 text-[13px]">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-ink-3 [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-accent group-open:hidden">Why</span>
                <span className="hidden font-medium text-accent group-open:inline">Hide</span>
                {p.modules.map((m) => (
                  <ModuleLink key={m} id={m} className="text-ink-2" />
                ))}
                <span>{ev === 1 ? "1 mistake as evidence" : `${ev} mistakes`}</span>
              </summary>
              <p className="mt-1 text-ink-2">{p.detail}</p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
