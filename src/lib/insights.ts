// Rule based checks that run on every render. They catch the problems a study log can prove on its own.
// The weekly AI run adds deeper patterns on top of these.

import { TOPICS, getTopic, moduleLabel } from "./curriculum";
import { addDays, fmtDay, startOfWeek, type ISODate } from "./dates";
import { accuracy, type ModuleMastery, type PracticeEvent } from "./mastery";
import type { Plan } from "./planner";
import { weeklyHoursOn } from "./planner";
import { dueReviews, failedChecks, isOpen } from "./srs";
import { hoursBetween, type TimeEntry } from "./timelog";
import { errorTypeLabel, type Dataset, type ErrorType } from "./types";

export type Severity = "alert" | "warn" | "info";

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  action: string;
  modules: number[];
  href?: string;
}

export interface InsightContext {
  plan: Plan;
  mm: Map<number, ModuleMastery>;
  events: PracticeEvent[];
  entries: TimeEntry[];
}

const TYPE_ACTION: Record<ErrorType, string> = {
  concept: "Go back to the learning outcomes of the module with the most misses before doing more questions.",
  formula: "Write a one page formula sheet for these modules and rebuild it from memory twice this week.",
  calc: "Clear the calculator registers before every problem and redo your last five numeric misses slowly.",
  misread: "Underline what the question asks, words like NOT, most likely and closest to, before reading the options.",
  trap: "For every miss write one line on why the wrong option looked right. Distractors repeat.",
  time: "Do one timed set of 15 questions at 90 seconds each and log it as a topic test.",
};

const SEVERITY_RANK: Record<Severity, number> = { alert: 0, warn: 1, info: 2 };
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function detectInsights(ds: Dataset, today: ISODate, ctx: InsightContext): Insight[] {
  const out: Insight[] = [];
  const since56 = addDays(today, -56);
  const open = ds.mistakes.filter(isOpen);
  const recentOpen = open.filter((m) => m.createdOn >= since56);

  // 1. Pace
  const { plan } = ctx;
  if (!plan.examPassed && plan.remainingHours > 0.5) {
    if (plan.verdict === "behind") {
      out.push({
        id: "pace-behind",
        severity: "alert",
        title: "Your real pace does not finish the content in time",
        detail:
          plan.finishAtPace != null
            ? `At ${plan.measuredPace!.toFixed(1)} h a week, the last ${plan.measuredWeeks} weeks, content ends around ${fmtDay(plan.finishAtPace)}, ${plan.lateDays} days into the mock phase.`
            : `At ${plan.measuredPace!.toFixed(1)} h a week the remaining ${Math.round(plan.remainingHours)} h do not fit before the exam.`,
        action:
          plan.requiredWeekly != null
            ? `Plan for about ${Math.ceil(plan.requiredWeekly)} h a week from now on, or shorten the mock phase in Settings.`
            : "Shorten the mock phase or lower the hours budget of low weight modules in Settings.",
        modules: [],
        href: "/plan",
      });
    } else if (!plan.fits && plan.requiredWeekly != null) {
      out.push({
        id: "plan-overload",
        severity: "warn",
        title: "The plan needs more hours than you scheduled",
        detail: `${Math.round(plan.remainingHours)} h of content are left and your schedule gives ${Math.round(plan.capacityHours)} h before the mock phase.`,
        action: `The plan already assumes about ${Math.ceil(plan.requiredWeekly)} h a week. Raise your weekly hours or trim module budgets.`,
        modules: [],
        href: "/plan",
      });
    }
  }
  if (plan.inMockPhase && plan.remainingHours > 0.5) {
    out.push({
      id: "content-in-mocks",
      severity: "alert",
      title: "Content is still open in the mock phase",
      detail: `${plan.remainingModules} modules, about ${Math.round(plan.remainingHours)} h, are not done.`,
      action: "Cover the highest weight topics first and keep at least two full mocks.",
      modules: [],
      href: "/plan",
    });
  }

  // 2. Volume drop, two complete weeks under half of the plan
  const cw = startOfWeek(today);
  const w1 = addDays(cw, -7);
  const w2 = addDays(cw, -14);
  if (w2 >= startOfWeek(ds.profile.startDate)) {
    const h1 = hoursBetween(ctx.entries, w1, addDays(w1, 6));
    const h2 = hoursBetween(ctx.entries, w2, addDays(w2, 6));
    const t1 = weeklyHoursOn(ds.profile, w1).hours;
    const t2 = weeklyHoursOn(ds.profile, w2).hours;
    if (t1 > 0 && t2 > 0 && h1 < t1 / 2 && h2 < t2 / 2) {
      out.push({
        id: "volume-drop",
        severity: "warn",
        title: "Two weeks in a row under half of your hours",
        detail: `You logged ${h2.toFixed(1)} h and ${h1.toFixed(1)} h against ${t2} h and ${t1} h planned.`,
        action:
          "If this is a busy stretch at university, add a capacity change in Settings so the plan stops assuming hours you do not have.",
        modules: [],
        href: "/settings",
      });
    }
  }

  // 3. Confident misses
  const sure = recentOpen.filter((m) => m.certainty === "sure");
  if (sure.length >= 3) {
    out.push({
      id: "confident-misses",
      severity: "alert",
      title: `You were sure on ${sure.length} misses`,
      detail:
        "A confident miss means a wrong belief, not a gap. Those cost the most on exam day because you will not flag them for review.",
      action: "Re-check these first and write the correct rule in each lesson field.",
      modules: [...new Set(sure.map((m) => m.moduleId))].slice(0, 6),
      href: "/mistakes?certainty=sure",
    });
  }

  // 4. Error type cluster
  if (recentOpen.length >= 5) {
    const counts = new Map<ErrorType, number>();
    for (const m of recentOpen) counts.set(m.errorType, (counts.get(m.errorType) ?? 0) + 1);
    const [top, k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (k / recentOpen.length >= 0.4) {
      out.push({
        id: `type-${top}`,
        severity: "warn",
        title: `Most misses are ${errorTypeLabel(top).toLowerCase()} errors`,
        detail: `${k} of your ${recentOpen.length} open mistakes from the last 8 weeks have the same cause.`,
        action: TYPE_ACTION[top],
        modules: [...new Set(recentOpen.filter((m) => m.errorType === top).map((m) => m.moduleId))].slice(0, 6),
        href: `/mistakes?type=${top}`,
      });
    }
  }

  // 5. Module hotspots
  const perModule = new Map<number, number>();
  for (const m of open) perModule.set(m.moduleId, (perModule.get(m.moduleId) ?? 0) + 1);
  const hot = [...perModule.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  if (hot.length) {
    out.push({
      id: "module-hotspot",
      severity: "warn",
      title: hot.length === 1 ? `${moduleLabel(hot[0][0])} keeps tripping you up` : `${hot.length} modules keep tripping you up`,
      detail: hot
        .slice(0, 3)
        .map(([id, n]) => `${moduleLabel(id)} has ${n} open mistakes`)
        .join(", ")
        .concat("."),
      action: "Ask the Lab for a medium set on the worst one and redo its practice problems without notes.",
      modules: hot.slice(0, 3).map(([id]) => id),
      href: "/lab",
    });
  }

  // 6. Stubborn mistakes
  const stubborn = open.filter((m) => failedChecks(m) >= 2);
  if (stubborn.length) {
    out.push({
      id: "stubborn",
      severity: "warn",
      title: `${stubborn.length} mistake${stubborn.length === 1 ? "" : "s"} failed two re-checks`,
      detail: "Repeating the same explanation is not working for these.",
      action: "Change the approach. Build a worked example from scratch or explain it out loud as if teaching it.",
      modules: [...new Set(stubborn.map((m) => m.moduleId))].slice(0, 6),
      href: "/mistakes",
    });
  }

  // 7. Weak topic on recent practice
  for (const t of TOPICS) {
    const a = accuracy(ctx.events, (e) => e.topicId === t.id, today, 28);
    if (a.rawN >= 20 && a.raw / a.rawN < 0.55) {
      out.push({
        id: `weak-${t.id}`,
        severity: "alert",
        title: `${t.short} accuracy is ${pct(a.raw / a.rawN)} over the last 4 weeks`,
        detail: `${a.raw} of ${a.rawN} questions right. Below 55% the topic needs repair before new material.`,
        action: `Go back to the lowest mastery module in ${getTopic(t.id).name} before moving on.`,
        modules: [],
        href: "/map",
      });
    }
  }

  // 8. Practice share
  const since28 = addDays(today, -27);
  const recent = ctx.entries.filter((e) => e.day >= since28 && e.day <= today);
  const totalMin = recent.reduce((a, e) => a + e.minutes, 0);
  const practiceMin = recent.filter((e) => e.kind === "practice").reduce((a, e) => a + e.minutes, 0);
  const doneCount = Object.values(ds.progress).filter((p) => p.status === "done").length;
  if (totalMin >= 240 && doneCount >= 3 && practiceMin / totalMin < 0.25) {
    out.push({
      id: "low-practice",
      severity: "warn",
      title: `Only ${pct(practiceMin / totalMin)} of your time goes to questions`,
      detail: "Reading feels productive but the exam only rewards answering. Recall is what moves mastery.",
      action: "Aim for at least a third of your time on questions. Start every session with 10 questions on yesterday's module.",
      modules: [],
    });
  }

  // 9. Finished modules with no practice at all
  const untested = Object.values(ds.progress)
    .filter((p) => p.status === "done" && (ctx.mm.get(p.moduleId)?.acc.rawN ?? 0) === 0)
    .map((p) => p.moduleId);
  if (untested.length >= 3) {
    out.push({
      id: "untested",
      severity: "info",
      title: `${untested.length} finished modules have no questions logged`,
      detail: "Their mastery is a guess until you test them.",
      action: "Log one set of at least 10 questions for each of them.",
      modules: untested.slice(0, 6),
      href: "/modules?filter=untested",
    });
  }

  // 10. Reviews piling up
  const due = dueReviews(ds, today);
  if (due.length >= 5) {
    out.push({
      id: "reviews-piling",
      severity: "warn",
      title: `${due.length} spaced reviews are waiting`,
      detail: `The oldest is ${due[0].overdueDays} days late. Late reviews are where finished modules leak.`,
      action: "Clear the three oldest today, ten minutes of recall each.",
      modules: due.slice(0, 3).map((d) => d.moduleId),
      href: "/",
    });
  }

  // 11. Reported Lab questions
  const week = addDays(today, -6);
  const reported = new Map<number, number>();
  const qmap = new Map(ds.questions.map((q) => [q.id, q]));
  for (const r of ds.reports) {
    if (r.day < week) continue;
    const q = qmap.get(r.questionId);
    if (q) reported.set(q.moduleId, (reported.get(q.moduleId) ?? 0) + 1);
  }
  for (const [mod, n] of reported) {
    if (n >= 3) {
      out.push({
        id: `reported-${mod}`,
        severity: "info",
        title: `${moduleLabel(mod)} had ${n} Lab questions reported this week`,
        detail: "The weekly AI run skips that module for two weeks.",
        action: "Use your question bank for this module in the meantime.",
        modules: [mod],
        href: `/modules/${mod}`,
      });
    }
  }

  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
