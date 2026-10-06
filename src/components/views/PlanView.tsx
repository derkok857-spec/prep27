"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { getTopic, moduleLabel } from "@/lib/curriculum";
import { addDays, fmtDay, fmtDayYear, fmtRange, isISODate } from "@/lib/dates";
import { fmtHours, newId, plural } from "@/lib/format";
import type { PlanWeek } from "@/lib/planner";
import { ChartLegend, PLAN_LEGEND, PlanBars } from "../charts";
import { useData } from "../data";
import { moduleTitle } from "../domain";
import { Badge, Button, Card, CardTitle, Field, PageHeader, inputClass } from "../ui";

const PHASE_BADGE: Record<PlanWeek["phase"], { label: string; tone: "neutral" | "accent" | "good" | "mid" | "bad" }> = {
  past: { label: "Done", tone: "neutral" },
  content: { label: "Content", tone: "accent" },
  buffer: { label: "Buffer", tone: "good" },
  mock: { label: "Mocks", tone: "mid" },
  exam: { label: "Exam week", tone: "bad" },
};

function Verdict() {
  const { derived, ds } = useData();
  const p = derived.plan;
  let tone: "good" | "mid" | "bad" | "plain" = "plain";
  let title = "On plan";
  let text = "";
  if (p.examPassed) {
    title = "The exam date has passed";
    text = "Update the exam date in Settings to plan a new window.";
  } else if (p.remainingHours <= 0.5) {
    tone = "good";
    title = "All content is done";
    text = "From here the plan is reviews, weak modules and full mocks.";
  } else if (p.inMockPhase) {
    tone = "bad";
    title = "Content is still open in the mock phase";
    text = `${plural(p.remainingModules, "module")} left. Cover the highest weight topics first and keep at least two full mocks.`;
  } else if (!p.fits) {
    tone = "bad";
    title = "The content needs more hours than you scheduled";
    text = `To finish by ${fmtDay(p.contentEnd)} you need about ${p.requiredWeekly?.toFixed(1)} h a week instead of ${ds.profile.weeklyHours}. The weeks below already assume that pace.`;
  } else if (p.verdict === "behind") {
    tone = "bad";
    title = "Your real pace is behind the plan";
    text = p.finishAtPace
      ? `At ${p.measuredPace?.toFixed(1)} h a week you finish content around ${fmtDay(p.finishAtPace)}, ${p.lateDays} days into the mock phase.`
      : `At ${p.measuredPace?.toFixed(1)} h a week the content does not fit before the exam.`;
  } else if (p.verdict === "ahead") {
    tone = "good";
    title = "Ahead of plan";
    text = `At your real pace content ends around ${fmtDay(p.finishAtPace!)}, more than a week before the mocks start.`;
  } else if (p.verdict === "on-track") {
    tone = "good";
    title = "On track";
    text = `At your real pace content ends around ${fmtDay(p.finishAtPace!)}, just before the mocks start on ${fmtDay(p.mockStart)}.`;
  } else {
    title = "On plan";
    text = "Log two full weeks and the plan starts checking your real pace against it.";
  }
  const stats = [
    { label: "Content left", value: fmtHours(p.remainingHours), sub: plural(p.remainingModules, "module") },
    { label: "Hours before mocks", value: fmtHours(p.capacityHours), sub: p.fits ? `${fmtHours(p.bufferHours)} spare` : "not enough" },
    {
      label: "Pace needed",
      value: p.requiredWeekly != null ? `${p.requiredWeekly.toFixed(1)} h` : "–",
      sub: `per week, ${ds.profile.weeklyHours} h scheduled`,
    },
    {
      label: "Your real pace",
      value: p.measuredPace != null ? `${p.measuredPace.toFixed(1)} h` : "–",
      sub: p.measuredPace != null ? `average of the last ${p.measuredWeeks} weeks` : "needs two full weeks",
    },
  ];
  return (
    <Card tone={tone}>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-ink-2">{text}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <div className="text-[12px] font-medium text-ink-3">{s.label}</div>
            <div className="tabular text-lg font-semibold">{s.value}</div>
            <div className="text-[12px] text-ink-3">{s.sub}</div>
          </div>
        ))}
      </div>
      {p.remainingHours > 0.5 && !p.examPassed ? (
        <p className="mt-3 text-[13px] text-ink-3">
          {p.finishAtPlan ? `At the planned pace content ends ${fmtDayYear(p.finishAtPlan)}. ` : ""}
          {p.finishAtConfigured && p.finishAtConfigured !== p.finishAtPlan
            ? `At exactly ${ds.profile.weeklyHours} h a week it would end ${fmtDayYear(p.finishAtConfigured)}.`
            : ""}
        </p>
      ) : null}
    </Card>
  );
}

function WeekRow({ w }: { w: PlanWeek }) {
  const b = PHASE_BADGE[w.phase];
  const [open, setOpen] = useState(false);
  const items = [...w.items].sort((a, c) => c.hours - a.hours);
  const shown = open ? items : items.slice(0, 4);
  return (
    <li className={`rounded-xl border p-3 ${w.isCurrent ? "border-accent/50 bg-accent-soft" : "border-line bg-surface"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-sm font-semibold">{fmtRange(w.start, w.end)}</span>
        <Badge tone={b.tone}>
          {b.label}
          {w.mockIndex ? ` ${w.mockIndex}` : ""}
        </Badge>
        {w.isCurrent ? <Badge tone="accent">This week</Badge> : null}
        {w.note ? <Badge>{w.note}</Badge> : null}
        <span className="tabular ml-auto text-[13px] text-ink-3">
          {w.phase === "past"
            ? `${fmtHours(w.logged)} logged`
            : w.isCurrent
              ? `${fmtHours(w.logged)} logged · ${fmtHours(w.planned)} to go`
              : w.planned > 0
                ? `${fmtHours(w.planned)} planned`
                : ""}
        </span>
      </div>
      {w.phase === "mock" ? (
        <p className="mt-1.5 text-[13px] text-ink-2">
          One full mock under exam conditions, then review every miss and log the mistakes. Fill the rest with weak modules.
        </p>
      ) : null}
      {w.phase === "exam" ? (
        <p className="mt-1.5 text-[13px] text-ink-2">Light review of your mistake bank and formula sheet. Sleep well.</p>
      ) : null}
      {w.phase === "buffer" ? (
        <p className="mt-1.5 text-[13px] text-ink-2">No new content. Reviews, open mistakes and the weakest modules on the map.</p>
      ) : null}
      {w.phase === "past" && w.doneModules.length ? (
        <p className="mt-1.5 text-[13px] text-ink-3">Finished {w.doneModules.map(moduleLabel).join(", ")}</p>
      ) : null}
      {shown.length ? (
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {shown.map((it) => (
            <li key={it.moduleId} className="flex items-baseline gap-2 text-[13px]">
              <span className="tabular w-12 shrink-0 text-right text-ink-3">{fmtHours(it.hours)}</span>
              <Link href={`/modules/${it.moduleId}`} className="truncate hover:text-accent" title={moduleTitle(it.moduleId)}>
                <span className="font-medium">{moduleLabel(it.moduleId)}</span>{" "}
                <span className="text-ink-2">{moduleTitle(it.moduleId)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length > 4 ? (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-[13px] font-medium text-accent hover:underline">
          {open ? "Show less" : `Show ${items.length - 4} more`}
        </button>
      ) : null}
    </li>
  );
}

function ScheduleSettings() {
  const { ds, actions, today } = useData();
  const p = ds.profile;
  const [hours, setHours] = useState(String(p.weeklyHours));
  const [from, setFrom] = useState(addDays(today, 7));
  const [to, setTo] = useState(addDays(today, 13));
  const [capHours, setCapHours] = useState("6");
  const [note, setNote] = useState("");

  const saveHours = () => {
    const n = Number(hours);
    if (Number.isFinite(n) && n >= 1 && n <= 80 && n !== p.weeklyHours) void actions.saveProfile({ weeklyHours: n });
  };
  const move = (i: number, d: -1 | 1) => {
    const order = [...p.topicOrder];
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void actions.saveProfile({ topicOrder: order });
  };
  const addChange = (e: FormEvent) => {
    e.preventDefault();
    const h = Number(capHours);
    if (!isISODate(from) || !isISODate(to) || from > to || !Number.isFinite(h) || h < 0 || h > 80) return;
    void actions.saveProfile({
      capacityChanges: [...p.capacityChanges, { id: newId(), from, to, hours: h, note: note.trim().slice(0, 120) }],
    });
    setNote("");
  };
  const removeChange = (id: string) => void actions.saveProfile({ capacityChanges: p.capacityChanges.filter((c) => c.id !== id) });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardTitle sub="The plan spreads these over Monday to Saturday">Weekly hours and mocks</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Hours a week" className="w-32">
            <input
              type="number"
              min={1}
              max={80}
              step={0.5}
              className={inputClass}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onBlur={saveHours}
              onKeyDown={(e) => e.key === "Enter" && saveHours()}
            />
          </Field>
          <Field label="Mock weeks before the exam" className="w-48">
            <select
              className={inputClass}
              value={p.mockWeeks}
              onChange={(e) => void actions.saveProfile({ mockWeeks: Number(e.target.value) })}
            >
              {[0, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? "No mock phase" : plural(n, "week")}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-[13px] text-ink-3">
          Exam date {fmtDayYear(p.examDate)} and the {p.targetHours} h content budget live in{" "}
          <Link href="/settings" className="font-medium text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
        <h3 className="mb-2 mt-5 text-sm font-semibold">Topic order</h3>
        <ol className="space-y-1">
          {p.topicOrder.map((t, i) => (
            <li key={t} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <span className="tabular w-5 text-ink-3">{i + 1}</span>
              <span className="flex-1">{getTopic(t).name}</span>
              <button
                type="button"
                aria-label={`Move ${getTopic(t).short} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-ink disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`Move ${getTopic(t).short} down`}
                disabled={i === p.topicOrder.length - 1}
                onClick={() => move(i, 1)}
                className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-ink disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <Card id="capacity">
        <CardTitle sub="Exams at university, holidays, an internship. The plan uses these hours on those dates.">
          Capacity changes
        </CardTitle>
        {p.capacityChanges.length ? (
          <ul className="mb-4 space-y-1.5">
            {[...p.capacityChanges]
              .sort((a, b) => (a.from < b.from ? -1 : 1))
              .map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <span className="tabular text-ink-2">{fmtRange(c.from, c.to)}</span>
                  <span className="font-semibold">{c.hours} h/week</span>
                  <span className="flex-1 truncate text-ink-3">{c.note}</span>
                  <button
                    type="button"
                    aria-label="Remove capacity change"
                    onClick={() => removeChange(c.id)}
                    className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-ink-3">None yet.</p>
        )}
        <form onSubmit={addChange} className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} required />
          </Field>
          <Field label="To">
            <input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
          </Field>
          <Field label="Hours a week">
            <input
              type="number"
              min={0}
              max={80}
              step={0.5}
              className={inputClass}
              value={capHours}
              onChange={(e) => setCapHours(e.target.value)}
              required
            />
          </Field>
          <Field label="Label">
            <input className={inputClass} value={note} maxLength={120} placeholder="Finals" onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="col-span-2 flex justify-end">
            <Button type="submit" variant="primary">
              <Plus size={16} aria-hidden /> Add change
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/** Consecutive buffer weeks collapse into one row. */
function groupBuffers(weeks: PlanWeek[]): PlanWeek[][] {
  const out: PlanWeek[][] = [];
  for (const w of weeks) {
    const last = out[out.length - 1];
    if (w.phase === "buffer" && !w.isCurrent && last && last[0].phase === "buffer" && !last[0].isCurrent) last.push(w);
    else out.push([w]);
  }
  return out;
}

export function PlanView() {
  const { derived, ds } = useData();
  const p = derived.plan;
  const past = p.weeks.filter((w) => w.phase === "past");
  const ahead = p.weeks.filter((w) => w.phase !== "past");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Study plan"
        sub={`Recomputed from today. Content until ${fmtDay(p.contentEnd)}, mocks from ${fmtDay(p.mockStart)}, exam ${fmtDayYear(ds.profile.examDate)}.`}
      />
      <Verdict />
      <Card>
        <CardTitle sub="Planned hours per week from your first week to the exam">Whole plan</CardTitle>
        <PlanBars weeks={p.weeks} weeklyHours={ds.profile.weeklyHours} />
        <ChartLegend items={PLAN_LEGEND} />
      </Card>
      <section aria-labelledby="weeks-title">
        <h2 id="weeks-title" className="mb-3 text-[15px] font-semibold">
          Week by week
        </h2>
        <ul className="space-y-2">
          {groupBuffers(ahead).map((g) =>
            g.length === 1 ? (
              <WeekRow key={g[0].start} w={g[0]} />
            ) : (
              <li key={g[0].start} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-sm font-semibold">{fmtRange(g[0].start, g[g.length - 1].end)}</span>
                  <Badge tone="good">Buffer</Badge>
                  <span className="tabular ml-auto text-[13px] text-ink-3">{plural(g.length, "week")}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-ink-2">
                  Content is done by then. Reviews, open mistakes and the weakest modules on the map, plus early mocks if you want them.
                </p>
              </li>
            ),
          )}
        </ul>
        {past.length ? (
          <details className="mt-3 rounded-xl border border-line bg-surface p-3">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">Past weeks ({past.length})</summary>
            <ul className="mt-3 space-y-2">
              {[...past].reverse().map((w) => (
                <WeekRow key={w.start} w={w} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      <ScheduleSettings />
    </div>
  );
}
