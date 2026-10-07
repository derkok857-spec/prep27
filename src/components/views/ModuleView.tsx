"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, FlaskConical, Trash2 } from "lucide-react";
import { baseHours, getModule, getTopic, modulesOf } from "@/lib/curriculum";
import { fmtDay, fmtDayYear } from "@/lib/dates";
import { progressOf } from "@/lib/defaults";
import { fmtHours, pct, plural } from "@/lib/format";
import { CONFIDENCE_VALUE, reviewsDone } from "@/lib/mastery";
import { questionState } from "@/lib/lab";
import { REVIEW_LABEL, isOpen, reviewSlots } from "@/lib/srs";
import { CONFIDENCE_LABEL, errorTypeLabel, sourceLabel, type Confidence, type Status } from "@/lib/types";
import { useData } from "../data";
import { QuickLog, RequestForm } from "../forms";
import { Badge, Button, Card, CardTitle, Empty, LinkButton, MasteryBadge, Segmented, inputClass } from "../ui";

export function ModuleView({ id }: { id: number }) {
  const { ds, derived, actions, today } = useData();
  const m = getModule(id);
  const p = progressOf(ds, id);
  const [notes, setNotes] = useState(p.notes);
  const [hours, setHours] = useState(p.hoursOverride != null ? String(p.hoursOverride) : "");
  if (!m) return <Empty>Unknown module.</Empty>;

  const t = getTopic(m.topic);
  const info = derived.mm.get(id)!;
  const sched = derived.plan.schedule.get(id);
  const remaining = derived.plan.remainingByModule.get(id);
  const siblings = modulesOf(m.topic);
  const idx = siblings.findIndex((x) => x.id === id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  const minutes = derived.entries.filter((e) => e.moduleId === id).reduce((a, e) => a + e.minutes, 0);
  const sessions = ds.sessions.filter((s) => s.moduleId === id).sort((a, b) => (a.day < b.day ? 1 : -1));
  const attempts = ds.attempts.filter((a) => a.moduleId === id).sort((a, b) => (a.day < b.day ? 1 : -1));
  const mistakes = ds.mistakes
    .filter((x) => x.moduleId === id)
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (a.createdOn < b.createdOn ? 1 : -1));
  const questions = ds.questions.filter((q) => q.moduleId === id);
  const waiting = questions.filter((q) => questionState(q, derived.answersByQ, derived.reported) === "waiting").length;
  const slots = reviewSlots(p);

  const accPart = (info.acc.c + 2) / (info.acc.n + 4);
  const confPart = p.confidence ? CONFIDENCE_VALUE[p.confidence] : 0.5;
  const revPart = p.status === "done" ? reviewsDone(p) / 3 : 0;

  const saveNotes = () => {
    if (notes !== p.notes) void actions.setNotes(id, notes);
  };
  const saveHours = () => {
    const v = hours.trim() === "" ? null : Number(hours);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) return;
    if (v !== p.hoursOverride) void actions.setHoursOverride(id, v);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/modules" className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Modules
        </Link>
        <p className="mt-3 text-sm font-medium text-ink-3">
          {t.name} · LM{m.lm} of {siblings.length} · {t.weightMin}–{t.weightMax}% of the exam
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{m.title}</h1>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Status</span>
            <Segmented<Status>
              label="Status"
              value={p.status}
              onChange={(s) => void actions.setStatus(id, s)}
              options={[
                { value: "todo", label: "To do" },
                { value: "reading", label: "Reading" },
                { value: "done", label: "Done" },
              ]}
            />
          </div>
          <div>
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Confidence</span>
            <Segmented<Confidence | 0>
              label="Confidence"
              value={p.confidence ?? 0}
              onChange={(c) => void actions.setConfidence(id, c === 0 ? null : c)}
              options={[
                { value: 0, label: "Not rated" },
                { value: 1, label: CONFIDENCE_LABEL[1] },
                { value: 2, label: CONFIDENCE_LABEL[2] },
                { value: 3, label: CONFIDENCE_LABEL[3] },
              ]}
            />
          </div>
          <div className="ml-auto text-right">
            <span className="mb-1 block text-[12px] font-medium text-ink-3">Mastery</span>
            <MasteryBadge value={info.mastery} />
          </div>
        </div>
        <div className="mt-4">
          <QuickLog moduleId={id} compact />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Practice</div>
          <div className="ui-stat-value tabular text-xl font-semibold">{info.acc.rawN ? pct(info.acc.raw / info.acc.rawN) : "–"}</div>
          <div className="text-[12px] text-ink-3">{info.acc.rawN ? `${info.acc.raw}/${info.acc.rawN} right` : "no questions yet"}</div>
        </div>
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Last 4 weeks</div>
          <div className="ui-stat-value tabular text-xl font-semibold">{info.acc28.rawN ? pct(info.acc28.raw / info.acc28.rawN) : "–"}</div>
          <div className="text-[12px] text-ink-3">{plural(info.acc28.rawN, "question")}</div>
        </div>
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">Time logged</div>
          <div className="ui-stat-value tabular text-xl font-semibold">{fmtHours(minutes / 60)}</div>
          <div className="text-[12px] text-ink-3">of a {fmtHours(info.hours)} budget</div>
        </div>
        <div className="ui-stat rounded-2xl border border-line bg-surface p-3.5">
          <div className="ui-stat-label text-[12px] font-medium uppercase tracking-wide text-ink-3">
            {p.status === "done" ? "Finished" : "Planned"}
          </div>
          <div className="ui-stat-value tabular text-xl font-semibold">
            {p.status === "done" && p.doneAt ? fmtDay(p.doneAt) : sched ? fmtDay(sched.from) : "–"}
          </div>
          <div className="text-[12px] text-ink-3">
            {p.status === "done" ? "reviews below" : remaining != null ? `${fmtHours(remaining)} left` : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle info="Mastery = 60% practice accuracy + 20% confidence + 20% reviews done.">How mastery is built</CardTitle>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-ink-2">Practice accuracy, recent questions count more</span>
              <span className="tabular font-medium">{pct(accPart)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-2">
                Confidence {p.confidence ? `(${CONFIDENCE_LABEL[p.confidence].toLowerCase()})` : "(not rated, counts as neutral)"}
              </span>
              <span className="tabular font-medium">{pct(confPart)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-2">Spaced reviews done</span>
              <span className="tabular font-medium">{p.status === "done" ? `${reviewsDone(p)} of 3` : "after you finish"}</span>
            </li>
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">
            {info.mastery == null
              ? "No evidence yet. Finish the module, rate your confidence or log practice to get a score."
              : `${pct(0.6 * accPart)} + ${pct(0.2 * confPart)} + ${pct(0.2 * revPart)} = ${pct(info.mastery)}. Green starts at 65%.`}
          </p>
        </Card>

        <Card>
          <CardTitle sub={p.status === "done" ? `Finished ${fmtDayYear(p.doneAt ?? today)}` : "Reviews start the day after you finish"}>
            Spaced reviews
          </CardTitle>
          {slots.length ? (
            <ul className="space-y-2">
              {slots.map((s) => (
                <li key={s.key} className="flex items-center gap-3 text-sm">
                  <span className="flex-1">{REVIEW_LABEL[s.key]}</span>
                  {s.doneOn ? (
                    <Badge tone="good">
                      <Check size={12} aria-hidden /> {fmtDay(s.doneOn)}
                    </Badge>
                  ) : s.due <= today ? (
                    <Button size="sm" variant="good" onClick={() => void actions.markReview(id, s.key)}>
                      Mark reviewed
                    </Button>
                  ) : (
                    <span className="tabular text-ink-3">due {fmtDay(s.due)}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Mark the module done to schedule its reviews.</Empty>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle info="Formulas, traps, anything you want to remember. The weekly AI run reads these to aim its questions.">
          Notes
        </CardTitle>
        <textarea
          className={`${inputClass} min-h-28`}
          value={notes}
          maxLength={4000}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          aria-label="Notes"
          placeholder="Your own words only. Do not paste text from study materials."
        />
        <div className="mt-2 flex items-center justify-between text-[12px] text-ink-3">
          <span>Saves when you leave the box</span>
          <span className="flex items-center gap-2">
            <label htmlFor="hours-override">Hours budget</label>
            <input
              id="hours-override"
              type="number"
              min={0}
              max={100}
              step={0.25}
              className="w-20 rounded-lg border border-line-strong bg-surface px-2 py-1 text-[13px]"
              placeholder={baseHours(id, ds.profile.targetHours).toFixed(1)}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onBlur={saveHours}
            />
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle
            action={
              <LinkButton href={`/lab?module=${id}`} size="sm">
                <FlaskConical size={14} aria-hidden /> Lab
              </LinkButton>
            }
            sub={
              questions.length ? `${plural(questions.length, "AI question")}, ${waiting} waiting` : "No AI questions for this module yet"
            }
          >
            Ask the Lab
          </CardTitle>
          <RequestForm moduleId={id} />
        </Card>

        <Card>
          <CardTitle sub={`${mistakes.filter(isOpen).length} open`}>Mistakes</CardTitle>
          {mistakes.length ? (
            <ul className="divide-y divide-line">
              {mistakes.map((x) => (
                <li key={x.id} className="py-2.5 first:pt-0">
                  <p className={`text-sm ${isOpen(x) ? "text-ink" : "text-ink-3 line-through"}`}>{x.description}</p>
                  <p className="text-[12px] text-ink-3">
                    {errorTypeLabel(x.errorType)} · {sourceLabel(x.source)} · {fmtDay(x.createdOn)}
                    {isOpen(x) && x.nextReview ? (x.nextReview <= today ? " · re-check due" : ` · next check ${fmtDay(x.nextReview)}`) : ""}
                  </p>
                  {x.lesson ? <p className="mt-1 text-[13px] text-ink-2">{x.lesson}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No mistakes logged for this module.</Empty>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Log</CardTitle>
        {attempts.length || sessions.length ? (
          <ul className="divide-y divide-line text-sm">
            {[
              ...attempts.map((a) => ({ key: a.id, day: a.day, kind: "practice" as const, a })),
              ...sessions.map((s) => ({ key: s.id, day: s.day, kind: "session" as const, s })),
            ]
              .sort((x, y) => (x.day < y.day ? 1 : -1))
              .slice(0, 30)
              .map((row) => (
                <li key={row.key} className="flex items-center gap-3 py-2">
                  <span className="tabular w-14 shrink-0 text-ink-3">{fmtDay(row.day)}</span>
                  {row.kind === "practice" ? (
                    <span className="flex-1">
                      <span className="font-medium">
                        {row.a.correct}/{row.a.questions}
                      </span>{" "}
                      <span className="text-ink-3">
                        {pct(row.a.correct / row.a.questions)} · {sourceLabel(row.a.source)}
                        {row.a.minutes ? ` · ${row.a.minutes} min` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="flex-1">
                      <span className="font-medium">{row.s.minutes} min</span>{" "}
                      <span className="text-ink-3">
                        {row.s.kind === "review" ? "review" : "learning"}
                        {row.s.note ? ` · ${row.s.note}` : ""}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Delete entry"
                    onClick={() => void (row.kind === "practice" ? actions.deleteAttempt(row.key) : actions.deleteSession(row.key))}
                    className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <Empty>Nothing logged for this module yet.</Empty>
        )}
      </Card>

      <div className="flex justify-between text-sm">
        {prev ? (
          <Link href={`/modules/${prev.id}`} className="text-ink-3 hover:text-ink">
            ← LM{prev.lm} {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/modules/${next.id}`} className="text-right text-ink-3 hover:text-ink">
            LM{next.lm} {next.title} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
