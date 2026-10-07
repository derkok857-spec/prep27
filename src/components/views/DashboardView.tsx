"use client";

import { useMemo } from "react";
import { getTopic } from "@/lib/curriculum";
import { addDays, startOfWeek } from "@/lib/dates";
import { fmtHours, pct, plural } from "@/lib/format";
import { weeklyHoursOn } from "@/lib/planner";
import { accuracyByTopic, accuracyByWeek, questionsSince, readinessHistory, streakDays, totalHours } from "@/lib/stats";
import { hoursBetween, hoursByWeek, minutesByDay } from "@/lib/timelog";
import { PRACTICE_SOURCES } from "@/lib/types";
import { AccuracyTrendChart, ChartLegend, HBarList, ReadinessChart, WeeklyHoursChart } from "../charts";
import { useData } from "../data";
import { InsightList } from "../domain";
import { Card, CardTitle, Empty, PageHeader, Stat } from "../ui";

export function DashboardView() {
  const { ds, derived, today } = useData();
  const { entries, events, plan } = derived;
  const start = ds.profile.startDate <= today ? ds.profile.startDate : today;

  const weeks = useMemo(() => hoursByWeek(entries, start, today), [entries, start, today]);
  const accWeeks = useMemo(() => accuracyByWeek(events, start, today), [events, start, today]);
  const readinessPts = useMemo(() => readinessHistory(ds, events, start, today), [ds, events, start, today]);
  const byTopic = useMemo(() => accuracyByTopic(events, today, 56), [events, today]);
  const q30 = questionsSince(events, addDays(today, -29), today);
  const streak = streakDays(minutesByDay(entries), today);
  const total = totalHours(entries, today);
  const wk = startOfWeek(today);
  const thisWeek = hoursBetween(entries, wk, today);
  const weekTarget = weeklyHoursOn(ds.profile, today).hours;
  const prevReadiness = readinessPts.length > 4 ? readinessPts[readinessPts.length - 5].value : null;
  const doneCount = Object.values(ds.progress).filter((p) => p.status === "done").length;

  const bySource = PRACTICE_SOURCES.map((s) => {
    let n = 0;
    let c = 0;
    for (const e of events) {
      if (e.source !== s.id) continue;
      n += e.n;
      c += e.c;
    }
    return { ...s, n, c };
  }).filter((s) => s.n > 0);

  const practiceShare = (() => {
    const since = addDays(today, -27);
    let all = 0;
    let pr = 0;
    for (const e of entries) {
      if (e.day < since || e.day > today) continue;
      all += e.minutes;
      if (e.kind === "practice") pr += e.minutes;
    }
    return all > 0 ? pr / all : null;
  })();

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Hours studied"
          value={fmtHours(total)}
          sub={`${fmtHours(thisWeek)} this week of ${weekTarget} h`}
          tone={thisWeek >= weekTarget ? "good" : undefined}
        />
        <Stat
          label="Questions, 30 days"
          value={q30.n}
          sub={q30.rate != null ? `${pct(q30.rate)} right` : "none logged"}
          tone={q30.rate == null ? undefined : q30.rate >= 0.65 ? "good" : q30.rate < 0.55 ? "bad" : "mid"}
        />
        <Stat
          label="Readiness"
          value={pct(derived.readiness)}
          sub={
            prevReadiness != null
              ? `${derived.readiness >= prevReadiness ? "+" : ""}${((derived.readiness - prevReadiness) * 100).toFixed(1)} pts in 4 weeks`
              : "exam weighted evidence"
          }
        />
        <Stat
          label="Modules done"
          value={`${doneCount}/102`}
          sub={streak ? `${plural(streak, "day")} study streak` : `${plan.daysToExam} days to the exam`}
        />
      </div>

      <Card>
        <CardTitle info="Stacked by activity. The dark tick is the plan for that week.">Hours per week</CardTitle>
        {weeks.some((w) => w.total > 0) ? (
          <>
            <WeeklyHoursChart weeks={weeks} target={(s) => weeklyHoursOn(ds.profile, s).hours} />
            <ChartLegend
              items={[
                { label: "Learning", color: "var(--color-accent)" },
                { label: "Practice", color: "var(--color-cell-good)" },
                { label: "Review", color: "var(--color-cell-mid)" },
                { label: "Plan", color: "var(--color-ink)", line: true },
              ]}
            />
            {practiceShare != null ? (
              <p className="mt-2 text-[13px] text-ink-3">
                Practice is {pct(practiceShare)} of your time over the last four weeks. A third or more is a healthy share once content is
                moving.
              </p>
            ) : null}
          </>
        ) : (
          <Empty>Log your first study session and the weekly chart starts here.</Empty>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle info="Dashed lines at 55% and 65%. Bigger dots mean more questions.">Accuracy by week</CardTitle>
          {accWeeks.some((w) => w.n > 0) ? <AccuracyTrendChart data={accWeeks} /> : <Empty>No practice logged yet.</Empty>}
        </Card>
        <Card>
          <CardTitle info="Share of exam weight backed by evidence, replayed week by week.">Readiness over time</CardTitle>
          {readinessPts.length > 1 ? (
            <ReadinessChart points={readinessPts} />
          ) : (
            <Empty>Readiness history appears after your first full week.</Empty>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Last 8 weeks" info="Logged practice sets and first answers in the Lab.">
            Accuracy by topic
          </CardTitle>
          {byTopic.some((t) => t.rawN > 0) ? (
            <HBarList
              rows={byTopic
                .filter((t) => t.rawN > 0)
                .map((t) => ({ key: t.topic, label: getTopic(t.topic).name, value: t.rate, sub: `${t.raw}/${t.rawN}` }))}
            />
          ) : (
            <Empty>No practice in the last 8 weeks.</Empty>
          )}
        </Card>
        <Card>
          <CardTitle sub="All time">Where your questions come from</CardTitle>
          {bySource.length ? (
            <HBarList rows={bySource.map((s) => ({ key: s.id, label: s.label, value: s.c / s.n, sub: `${s.c}/${s.n}` }))} />
          ) : (
            <Empty>No practice logged yet.</Empty>
          )}
        </Card>
      </div>

      <Card id="checks">
        <CardTitle info="These rules run on every change to your log.">All checks</CardTitle>
        {derived.insights.length ? <InsightList items={derived.insights} /> : <Empty>Nothing to flag right now.</Empty>}
      </Card>
    </div>
  );
}
