// Compact, read only view of the study log for the weekly AI worker. Pure function, tested with the demo data.

import { MODULES, getTopic } from "../curriculum";
import { addDays, endOfWeek, startOfWeek, type ISODate } from "../dates";
import { progressOf } from "../defaults";
import { weakModules } from "../focus";
import { detectInsights } from "../insights";
import { answersByQuestion, skippedModules, waitingQuestions } from "../lab";
import { allTopicStats, masteryMap, practiceEvents, readiness } from "../mastery";
import { buildPlan } from "../planner";
import { failedChecks, isOpen } from "../srs";
import { hoursBetween, timeEntries } from "../timelog";
import type { Dataset } from "../types";

const round = (v: number | null | undefined, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

export function buildSnapshot(ds: Dataset, today: ISODate, timeZone = "America/Lima") {
  const events = practiceEvents(ds);
  const entries = timeEntries(ds);
  const mm = masteryMap(ds, today, events);
  const plan = buildPlan(ds, today, entries);
  const stats = allTopicStats(mm, ds);
  const since28 = addDays(today, -27);
  const since56 = addDays(today, -55);

  let q28 = 0;
  let c28 = 0;
  for (const e of events) {
    if (e.day >= since28 && e.day <= today) {
      q28 += e.n;
      c28 += e.c;
    }
  }

  const wk = startOfWeek(today);
  const inRange = (from: ISODate, to: ISODate) =>
    [...plan.schedule.entries()].filter(([, s]) => s.from <= to && s.to >= from).map(([id]) => id);

  const modules = MODULES.map((m) => {
    const p = progressOf(ds, m.id);
    const info = mm.get(m.id)!;
    const sched = plan.schedule.get(m.id);
    return {
      id: m.id,
      topic: m.topic,
      lm: m.lm,
      title: m.title,
      status: p.status,
      confidence: p.confidence,
      doneAt: p.doneAt,
      mastery: round(info.mastery),
      practice28: { n: info.acc28.rawN, c: info.acc28.raw },
      practiceAll: { n: info.acc.rawN, c: info.acc.raw },
      notes: p.notes ? p.notes.slice(0, 600) : undefined,
      planned: sched ? { from: sched.from, to: sched.to } : undefined,
    };
  });

  const byQ = answersByQuestion(ds.answers);
  const qmap = new Map(ds.questions.map((q) => [q.id, q]));
  const recentAnswers = [...byQ.entries()]
    .map(([questionId, list]) => ({ questionId, first: list[0] }))
    .filter(({ first }) => first.day >= since56)
    .map(({ questionId, first }) => {
      const q = qmap.get(questionId);
      return {
        questionId,
        moduleId: q?.moduleId ?? null,
        difficulty: q?.difficulty ?? null,
        day: first.day,
        correct: first.correct,
        certainty: first.certainty,
      };
    });

  const prev = [...ds.batches].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  return {
    version: 1,
    today,
    timeZone,
    exam: {
      date: plan.examDate,
      daysToExam: plan.daysToExam,
      mockStart: plan.mockStart,
      contentEnd: plan.contentEnd,
      inMockPhase: plan.inMockPhase,
    },
    pace: {
      weeklyHoursPlanned: ds.profile.weeklyHours,
      measuredPace: round(plan.measuredPace, 1),
      verdict: plan.verdict,
      requiredWeekly: round(plan.requiredWeekly, 1),
      remainingHours: round(plan.remainingHours, 1),
      remainingModules: plan.remainingModules,
    },
    stats: {
      hoursLast28Days: round(hoursBetween(entries, since28, today), 1),
      questionsLast28Days: { n: q28, c: c28 },
      readiness: round(readiness(stats), 3),
      topics: stats.map((t) => ({
        topic: t.topic,
        name: getTopic(t.topic).name,
        weight: t.weight,
        mastery: round(t.mastery),
        modulesDone: t.modulesDone,
        modulesTotal: t.modulesTotal,
      })),
    },
    thisWeek: {
      start: wk,
      end: endOfWeek(today),
      modules: inRange(today, endOfWeek(today)),
      nextWeekModules: inRange(addDays(wk, 7), addDays(wk, 13)),
    },
    modules,
    weakModules: weakModules(ds, today, mm, 8).map((w) => ({
      id: w.moduleId,
      mastery: round(w.mastery),
      lastContact: w.lastContact,
      labWaiting: w.labWaiting,
    })),
    mistakes: {
      open: ds.mistakes.filter(isOpen).map((m) => ({
        id: m.id,
        moduleId: m.moduleId,
        createdOn: m.createdOn,
        errorType: m.errorType,
        certainty: m.certainty,
        source: m.source,
        description: m.description,
        lesson: m.lesson,
        streak: m.streak,
        failedChecks: failedChecks(m),
      })),
      resolvedLast56Days: ds.mistakes.filter((m) => m.resolvedOn != null && m.resolvedOn >= since56).length,
    },
    insights: detectInsights(ds, today, { plan, mm, events, entries }).map((i) => ({
      id: i.id,
      severity: i.severity,
      title: i.title,
      detail: i.detail,
    })),
    lab: {
      waiting: waitingQuestions(ds).length,
      recentAnswers,
      reports: ds.reports
        .filter((r) => r.day >= addDays(today, -20))
        .map((r) => ({ questionId: r.questionId, moduleId: qmap.get(r.questionId)?.moduleId ?? null, day: r.day, reason: r.reason })),
      skipModules: skippedModules(ds, today),
      pendingRequests: ds.requests
        .filter((r) => r.servedBatchId == null)
        .map((r) => ({
          id: r.id,
          createdOn: r.createdOn,
          topicId: r.topicId,
          moduleId: r.moduleId,
          difficulty: r.difficulty,
          count: r.count,
          note: r.note,
        })),
      recentStems: ds.questions
        .filter((q) => q.createdAt.slice(0, 10) >= addDays(today, -60))
        .map((q) => ({ moduleId: q.moduleId, stem: q.stem.slice(0, 140) })),
    },
    previousBatch: prev ? { createdAt: prev.createdAt, summary: prev.summary, patterns: prev.patterns } : null,
  };
}

export type Snapshot = ReturnType<typeof buildSnapshot>;
