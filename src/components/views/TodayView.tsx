"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CircleCheck, Eye, FlaskConical, RotateCcw, X } from "lucide-react";
import { KEY_DATES, moduleLabel } from "@/lib/curriculum";
import { diffDays, fmtDay, fmtWeekday, relDays, startOfWeek } from "@/lib/dates";
import { progressOf } from "@/lib/defaults";
import { fmtHours, pct, plural } from "@/lib/format";
import { REVIEW_LABEL } from "@/lib/srs";
import { errorTypeLabel } from "@/lib/types";
import { useData } from "../data";
import { CoachNote, InsightList, ModuleLink, latestBatch, moduleTitle } from "../domain";
import { LogTimeForm, QuickLog } from "../forms";
import { Badge, Button, Card, CardTitle, Empty, LinkButton, MasteryBadge, Modal, ProgressBar } from "../ui";

export function TodayView() {
  const { ds, today, derived, actions } = useData();
  const { plan } = derived;
  const tp = plan.todayPlan;
  const [logFor, setLogFor] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const week = plan.weeks.find((w) => w.isCurrent);
  const weekIndex = plan.weeks.filter((w) => w.start <= startOfWeek(today)).length;
  const coming = [
    ...KEY_DATES.filter((k) => k.date >= today && diffDays(today, k.date) <= 45).map((k) => ({
      date: k.date,
      label: k.label,
      urgent: k.kind === "deadline" && diffDays(today, k.date) <= 14,
    })),
    ...(plan.mockStart >= today && diffDays(today, plan.mockStart) <= 45
      ? [{ date: plan.mockStart, label: "Mock phase starts", urgent: false }]
      : []),
    ...ds.profile.capacityChanges
      .filter((c) => c.from > today && diffDays(today, c.from) <= 30)
      .map((c) => ({ date: c.from, label: `${c.note || "Capacity change"} starts, ${c.hours} h a week`, urgent: false })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  const batch = latestBatch(ds.batches);
  const doneCount = Object.values(ds.progress).filter((p) => p.status === "done").length;
  const dueCount = derived.dueReviews.length + derived.dueMistakes.length;

  return (
    <div className="space-y-5">
      <div className="ui-pagehead flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ui-kicker text-sm font-medium text-ink-3">{fmtWeekday(today)}</p>
          <h1 className="ui-h1 text-2xl font-semibold tracking-tight">
            {plan.examPassed
              ? "Exam window passed"
              : tp.isReviewDay
                ? "Review day"
                : plan.inMockPhase
                  ? `Mock phase, week ${week?.mockIndex ?? ""}`
                  : "Today"}
          </h1>
          <p className="ui-h1-sub mt-1 text-sm text-ink-3">
            Week {weekIndex} of {plan.weeks.length} · {plan.daysToExam > 0 ? `${plan.daysToExam} days to the exam` : "exam window reached"}
          </p>
        </div>
        <QuickLog />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {/* Today's plan */}
          <Card>
            <CardTitle
              sub={
                tp.isReviewDay
                  ? "Sunday has no new content. Clear your reviews and re-checks, then rest."
                  : plan.inMockPhase
                    ? "Take or review a full mock, then fix the weakest topics."
                    : tp.items.length
                      ? `${fmtHours(tp.loggedHours)} logged of about ${fmtHours(tp.targetHours)} planned`
                      : "Nothing new is scheduled today."
              }
            >
              Plan for today
            </CardTitle>
            {!tp.isReviewDay && tp.targetHours > 0 ? (
              <ProgressBar
                value={tp.loggedHours}
                max={tp.targetHours}
                tone={tp.loggedHours >= tp.targetHours ? "good" : "accent"}
                label="Hours today"
                className="mb-4"
              />
            ) : null}
            {tp.items.length ? (
              <ul className="divide-y divide-line">
                {tp.items.map((it) => {
                  const p = progressOf(ds, it.moduleId);
                  const remaining = plan.remainingByModule.get(it.moduleId) ?? 0;
                  return (
                    <li key={it.moduleId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-[13rem] flex-1">
                        <ModuleLink id={it.moduleId} full />
                        <p className="text-[13px] text-ink-3">
                          {fmtHours(it.hours)} today · {fmtHours(remaining)} left in this module
                          {p.status === "reading" ? " · in progress" : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setLogFor(it.moduleId)}>
                          Log time
                        </Button>
                        <Button
                          size="sm"
                          variant="good"
                          onClick={() => void actions.setStatus(it.moduleId, "done")}
                          aria-label={`Mark ${moduleLabel(it.moduleId)} done`}
                        >
                          <Check size={14} aria-hidden /> Done
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : !tp.isReviewDay ? (
              plan.remainingModules === 0 ? (
                <Empty>All content is done. Spend the time on weak modules and full mocks.</Empty>
              ) : (
                <Empty>No content scheduled today. Use the time for reviews or weak spots.</Empty>
              )
            ) : null}
            {week && week.phase === "content" ? (
              <div className="mt-4 rounded-xl bg-sunken px-3 py-2.5 text-[13px] text-ink-2">
                This week · {fmtHours(week.logged)} logged · {fmtHours(week.planned)} of content left in the plan
                {week.note ? ` · ${week.note}` : ""}
              </div>
            ) : null}
          </Card>

          {/* Due now */}
          <Card>
            <CardTitle info={dueCount ? "Recall first, then new material. Do them without notes." : undefined}>
              Due now {dueCount ? <span className="tabular text-ink-3">· {dueCount}</span> : null}
            </CardTitle>
            {dueCount === 0 ? (
              <Empty>Nothing due. Nice.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {derived.dueReviews.map((r) => (
                  <li key={`${r.moduleId}-${r.key}`} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                    <RotateCcw size={16} className="text-accent" aria-hidden />
                    <div className="min-w-[13rem] flex-1">
                      <ModuleLink id={r.moduleId} full />
                      <p className="text-[13px] text-ink-3">
                        {REVIEW_LABEL[r.key]} · {r.overdueDays > 0 ? `${plural(r.overdueDays, "day")} late` : "due today"}
                      </p>
                    </div>
                    <Button size="sm" variant="good" onClick={() => void actions.markReview(r.moduleId, r.key)}>
                      <Check size={14} aria-hidden /> Reviewed
                    </Button>
                  </li>
                ))}
                {derived.dueMistakes.map((m) => {
                  const shown = revealed.has(m.id);
                  return (
                    <li key={m.id} className="py-3 last:pb-0">
                      <div className="flex flex-wrap items-start gap-3">
                        <CircleCheck size={16} className="mt-0.5 text-bad" aria-hidden />
                        <div className="min-w-[13rem] flex-1">
                          <p className="text-sm text-ink">{m.description}</p>
                          <p className="text-[13px] text-ink-3">
                            <ModuleLink id={m.moduleId} className="text-ink-3" /> · {errorTypeLabel(m.errorType)} · re-check {m.streak + 1}{" "}
                            of 3
                          </p>
                          {m.lesson ? (
                            shown ? (
                              <p className="mt-1 rounded-lg bg-sunken px-2.5 py-1.5 text-[13px] text-ink-2">{m.lesson}</p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRevealed(new Set(revealed).add(m.id))}
                                className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
                              >
                                <Eye size={14} aria-hidden /> Show the rule
                              </button>
                            )
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="good" onClick={() => void actions.recheckMistake(m.id, true)}>
                            <Check size={14} aria-hidden /> Got it
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => void actions.recheckMistake(m.id, false)}>
                            <X size={14} aria-hidden /> Missed
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {derived.insights.length ? (
            <Card>
              <CardTitle
                action={
                  <LinkButton href="/dashboard#checks" size="sm" variant="ghost">
                    All checks
                  </LinkButton>
                }
              >
                What needs attention
              </CardTitle>
              <InsightList items={derived.insights} limit={3} />
            </Card>
          ) : null}

          <Card>
            <CardTitle
              action={
                <LinkButton href="/lab" size="sm" variant={derived.waiting.length ? "primary" : "secondary"}>
                  <FlaskConical size={14} aria-hidden /> Open Lab
                </LinkButton>
              }
              sub={derived.waiting.length ? `${plural(derived.waiting.length, "question")} waiting` : "No questions waiting"}
            >
              Question Lab
            </CardTitle>
            <CoachNote batch={batch} compact />
          </Card>

          {derived.weak.length ? (
            <Card>
              <CardTitle info="Ranked by exam weight, weakness and time since you touched them.">Weak spots</CardTitle>
              <ul className="space-y-2.5">
                {derived.weak.slice(0, 3).map((w) => (
                  <li key={w.moduleId} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/modules/${w.moduleId}`} className="block truncate text-sm font-medium hover:text-accent">
                        {moduleLabel(w.moduleId)} · {moduleTitle(w.moduleId)}
                      </Link>
                      <p className="text-[12px] text-ink-3">
                        {w.lastContact ? `last touched ${relDays(diffDays(today, w.lastContact))}` : "not touched yet"}
                        {w.labWaiting ? ` · ${plural(w.labWaiting, "Lab question")} ready` : ""}
                      </p>
                    </div>
                    <MasteryBadge value={w.mastery} />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {coming.length ? (
            <Card>
              <CardTitle>Coming up</CardTitle>
              <ul className="space-y-2">
                {coming.map((c) => (
                  <li key={`${c.date}-${c.label}`} className="flex items-start gap-3 text-sm">
                    <span className="tabular w-14 shrink-0 text-ink-3">{fmtDay(c.date)}</span>
                    <span className="flex-1 text-ink">{c.label}</span>
                    {c.urgent ? <Badge tone="bad">{relDays(diffDays(today, c.date))}</Badge> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card tone="sunken">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="tabular text-xl font-semibold">{pct(derived.readiness)}</div>
                <div className="text-[12px] text-ink-3">readiness</div>
              </div>
              <div>
                <div className="tabular text-xl font-semibold">{doneCount}</div>
                <div className="text-[12px] text-ink-3">modules done</div>
              </div>
              <div>
                <div className="tabular text-xl font-semibold">{fmtHours(plan.remainingHours)}</div>
                <div className="text-[12px] text-ink-3">content left</div>
              </div>
            </div>
            <p className="mt-3 text-center text-[12px] text-ink-3">
              Content ends {fmtDay(plan.contentEnd)}, mocks start {fmtDay(plan.mockStart)} ·{" "}
              <Link href="/plan" className="font-medium text-accent hover:underline">
                See the plan
              </Link>
            </p>
          </Card>
        </div>
      </div>

      <Modal open={logFor != null} onClose={() => setLogFor(null)} title="Log study time">
        {logFor != null ? <LogTimeForm moduleId={logFor} onDone={() => setLogFor(null)} /> : null}
      </Modal>
    </div>
  );
}
