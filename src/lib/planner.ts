// Adaptive study plan. Recomputed from today on every render, so nothing is ever "overdue":
// falling behind shows up as a higher required pace instead.
//
// Rules
// - Content weeks run until the mock phase, which takes the last `mockWeeks` full weeks before the exam week.
// - Content time is spread over Monday to Saturday. Sunday is for reviews only.
// - Weekly hours come from the profile, with dated capacity changes (exams at university, holidays).
// - Unfinished modules are packed in topic order, the ones you are reading first.
// - If the remaining hours do not fit, the plan scales every day up and reports the pace you need.

import { MODULES, type TopicId } from "./curriculum";
import { addDays, diffDays, eachDay, endOfWeek, isSunday, maxDate, minDate, startOfWeek, type ISODate } from "./dates";
import { progressOf } from "./defaults";
import { moduleHours } from "./mastery";
import { minutesByDay, minutesByModule, timeEntries, type TimeEntry } from "./timelog";
import type { Dataset, Profile } from "./types";

export const MIN_REMAINING_SHARE = 0.25;
const EPS = 1e-6;

export interface PlanItem {
  moduleId: number;
  hours: number;
}

export type WeekPhase = "past" | "content" | "buffer" | "mock" | "exam";

export interface PlanWeek {
  start: ISODate;
  end: ISODate;
  phase: WeekPhase;
  isCurrent: boolean;
  /** content hours available, prorated from today in the current week */
  capacity: number;
  /** hours the plan asks for in this week */
  planned: number;
  logged: number;
  items: PlanItem[];
  doneModules: number[];
  mockIndex: number | null;
  note: string | null;
}

export type PaceVerdict = "done" | "ahead" | "on-track" | "behind" | "unknown";

export interface Plan {
  today: ISODate;
  examDate: ISODate;
  daysToExam: number;
  mockStart: ISODate;
  contentEnd: ISODate;
  inMockPhase: boolean;
  examPassed: boolean;
  remainingHours: number;
  remainingModules: number;
  capacityHours: number;
  scale: number;
  fits: boolean;
  /** weekly hours needed to finish content by contentEnd, null if nothing is left or no content days remain */
  requiredWeekly: number | null;
  bufferHours: number;
  finishAtPlan: ISODate | null;
  finishAtConfigured: ISODate | null;
  measuredPace: number | null;
  measuredWeeks: number;
  finishAtPace: ISODate | null;
  verdict: PaceVerdict;
  lateDays: number;
  weeks: PlanWeek[];
  todayPlan: TodayPlan;
  schedule: Map<number, { from: ISODate; to: ISODate; hours: number }>;
  remainingByModule: Map<number, number>;
}

export interface TodayPlan {
  isReviewDay: boolean;
  phase: WeekPhase;
  targetHours: number;
  items: PlanItem[];
  loggedHours: number;
}

export function weeklyHoursOn(profile: Profile, day: ISODate): { hours: number; note: string | null } {
  let hours = profile.weeklyHours;
  let note: string | null = null;
  const sorted = [...profile.capacityChanges].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  for (const c of sorted) {
    if (c.from <= day && day <= c.to) {
      hours = c.hours;
      note = c.note || null;
    }
  }
  return { hours, note };
}

export function dayCapacity(profile: Profile, day: ISODate): number {
  if (isSunday(day)) return 0;
  return weeklyHoursOn(profile, day).hours / 6;
}

export function phaseDates(profile: Profile) {
  const examWeek = startOfWeek(profile.examDate);
  const mockStart = addDays(examWeek, -7 * profile.mockWeeks);
  const contentEnd = addDays(mockStart, -1);
  return { examWeek, mockStart, contentEnd };
}

function topicRank(order: TopicId[]): Map<TopicId, number> {
  return new Map(order.map((t, i) => [t, i]));
}

/** Remaining hours per unfinished module, in the order the plan studies them. */
export function moduleQueue(
  ds: Pick<Dataset, "profile" | "progress">,
  loggedMinutes: Map<number, number>,
): { moduleId: number; remaining: number }[] {
  const rank = topicRank(ds.profile.topicOrder);
  const rows: { moduleId: number; remaining: number; reading: boolean; t: number; lm: number }[] = [];
  for (const m of MODULES) {
    const p = progressOf(ds, m.id);
    if (p.status === "done") continue;
    const h = moduleHours(p, ds.profile);
    if (h <= EPS) continue;
    const logged = (loggedMinutes.get(m.id) ?? 0) / 60;
    const remaining = logged > 0 ? Math.max(h - logged, h * MIN_REMAINING_SHARE) : h;
    rows.push({ moduleId: m.id, remaining, reading: p.status === "reading", t: rank.get(m.topic) ?? 99, lm: m.lm });
  }
  rows.sort((a, b) => Number(b.reading) - Number(a.reading) || a.t - b.t || a.lm - b.lm);
  return rows.map(({ moduleId, remaining }) => ({ moduleId, remaining }));
}

/** First day on which `work` hours of content are done, walking forward with a daily rate. */
function finishDay(profile: Profile, from: ISODate, work: number, factor: number, limitDays = 730): ISODate | null {
  if (work <= EPS) return from;
  if (factor <= EPS) return null;
  let acc = 0;
  let d = from;
  for (let i = 0; i < limitDays; i++, d = addDays(d, 1)) {
    acc += dayCapacity(profile, d) * factor;
    if (acc >= work - EPS) return d;
  }
  return null;
}

export function buildPlan(ds: Dataset, today: ISODate, entries: TimeEntry[] = timeEntries(ds)): Plan {
  const profile = ds.profile;
  const { examWeek, mockStart, contentEnd } = phaseDates(profile);
  const examPassed = today > profile.examDate;
  const byDay = minutesByDay(entries);
  const loggedToday = (byDay.get(today) ?? 0) / 60;

  // Time logged before today shrinks modules in progress. Today's time does not, so today's target stays put while you work.
  const loggedMods = minutesByModule(entries, addDays(today, -1));
  const queue = moduleQueue(ds, loggedMods);
  const remainingByModule = new Map(queue.map((q) => [q.moduleId, q.remaining]));
  const R = queue.reduce((a, q) => a + q.remaining, 0);

  const contentDays = today <= contentEnd ? eachDay(today, contentEnd) : [];
  const caps = contentDays.map((d) => dayCapacity(profile, d));
  const C = caps.reduce((a, b) => a + b, 0);
  const scale = C > EPS ? Math.max(1, R / C) : R > EPS ? Number.POSITIVE_INFINITY : 1;
  const fits = R <= C + EPS;

  // Pack the queue day by day.
  const dayItems: PlanItem[][] = contentDays.map(() => []);
  const schedule = new Map<number, { from: ISODate; to: ISODate; hours: number }>();
  let finishAtPlan: ISODate | null = R <= EPS ? today : null;
  if (Number.isFinite(scale)) {
    let qi = 0;
    let left = queue[0]?.remaining ?? 0;
    for (let i = 0; i < contentDays.length && qi < queue.length; i++) {
      let cap = caps[i] * scale;
      while (cap > EPS && qi < queue.length) {
        const take = Math.min(cap, left);
        const id = queue[qi].moduleId;
        dayItems[i].push({ moduleId: id, hours: take });
        const s = schedule.get(id);
        if (s) {
          s.to = contentDays[i];
          s.hours += take;
        } else {
          schedule.set(id, { from: contentDays[i], to: contentDays[i], hours: take });
        }
        cap -= take;
        left -= take;
        if (left <= EPS) {
          qi++;
          left = queue[qi]?.remaining ?? 0;
          if (qi >= queue.length) finishAtPlan = contentDays[i];
        }
      }
    }
  }

  // Weeks from the start of the study period to the exam week.
  const firstWeek = startOfWeek(minDate(profile.startDate, today));
  const currentWeek = startOfWeek(today);
  const weeks: PlanWeek[] = [];
  const dayIndex = new Map(contentDays.map((d, i) => [d, i]));
  let mockIndex = 0;
  for (let ws = firstWeek; ws <= examWeek; ws = addDays(ws, 7)) {
    const we = endOfWeek(ws);
    let logged = 0;
    for (const d of eachDay(ws, we)) logged += (byDay.get(d) ?? 0) / 60;
    const doneModules = MODULES.filter((m) => {
      const p = progressOf(ds, m.id);
      return p.status === "done" && p.doneAt != null && p.doneAt >= ws && p.doneAt <= we;
    }).map((m) => m.id);
    const notes = new Set<string>();
    for (const d of eachDay(ws, we)) {
      const n = weeklyHoursOn(profile, d).note;
      if (n) notes.add(n);
    }
    const note = notes.size ? [...notes].join(" · ") : null;

    let phase: WeekPhase;
    if (we < currentWeek) phase = "past";
    else if (ws >= examWeek) phase = "exam";
    else if (ws >= mockStart) phase = "mock";
    else phase = "content";

    const items = new Map<number, number>();
    let capacity = 0;
    let planned = 0;
    if (phase === "content") {
      for (const d of eachDay(maxDate(ws, today), we)) {
        const i = dayIndex.get(d);
        if (i == null) continue;
        capacity += caps[i];
        for (const it of dayItems[i]) {
          items.set(it.moduleId, (items.get(it.moduleId) ?? 0) + it.hours);
          planned += it.hours;
        }
      }
      if (planned <= EPS && (R <= EPS || (finishAtPlan != null && finishAtPlan < ws))) phase = "buffer";
    } else if (phase === "mock" || phase === "exam") {
      const lastDay = phase === "exam" ? addDays(profile.examDate, -1) : we;
      for (const d of eachDay(maxDate(ws, today), lastDay)) capacity += dayCapacity(profile, d);
      planned = capacity;
      if (phase === "mock") mockIndex++;
    }
    weeks.push({
      start: ws,
      end: we,
      phase,
      isCurrent: ws === currentWeek,
      capacity,
      planned,
      logged,
      items: [...items.entries()].map(([moduleId, hours]) => ({ moduleId, hours })),
      doneModules,
      mockIndex: phase === "mock" ? mockIndex : null,
      note,
    });
  }

  // Measured pace: average of the last four complete weeks inside the study period, at least two needed.
  const complete = weeks.filter((w) => w.end < currentWeek && w.start >= startOfWeek(profile.startDate));
  const lastFour = complete.slice(-4);
  const measuredPace = lastFour.length >= 2 ? lastFour.reduce((a, w) => a + w.logged, 0) / lastFour.length : null;

  const finishAtConfigured = finishDay(profile, today, R, 1);
  const finishAtPace = measuredPace == null ? null : finishDay(profile, today, R, measuredPace / Math.max(profile.weeklyHours, EPS));

  let verdict: PaceVerdict = "unknown";
  let lateDays = 0;
  if (R <= EPS) verdict = "done";
  else if (measuredPace != null) {
    if (finishAtPace == null) {
      verdict = "behind";
      lateDays = Math.max(0, diffDays(contentEnd, profile.examDate));
    } else if (finishAtPace <= addDays(contentEnd, -7)) verdict = "ahead";
    else if (finishAtPace <= contentEnd) verdict = "on-track";
    else {
      verdict = "behind";
      lateDays = diffDays(contentEnd, finishAtPace);
    }
  }

  const curWeek = weeks.find((w) => w.isCurrent);
  const todayIdx = dayIndex.get(today);
  const todayPlan: TodayPlan = {
    isReviewDay: isSunday(today),
    phase: curWeek?.phase ?? (examPassed ? "past" : "content"),
    targetHours:
      todayIdx != null && Number.isFinite(scale)
        ? dayItems[todayIdx].reduce((a, it) => a + it.hours, 0)
        : curWeek && (curWeek.phase === "mock" || curWeek.phase === "exam")
          ? dayCapacity(profile, today)
          : 0,
    items: todayIdx != null ? dayItems[todayIdx] : [],
    loggedHours: loggedToday,
  };

  return {
    today,
    examDate: profile.examDate,
    daysToExam: diffDays(today, profile.examDate),
    mockStart,
    contentEnd,
    inMockPhase: today >= mockStart && !examPassed,
    examPassed,
    remainingHours: R,
    remainingModules: queue.length,
    capacityHours: C,
    scale,
    fits,
    requiredWeekly: R > EPS && C > EPS ? (profile.weeklyHours * R) / C : null,
    bufferHours: Math.max(0, C - R),
    finishAtPlan,
    finishAtConfigured,
    measuredPace,
    measuredWeeks: lastFour.length,
    finishAtPace,
    verdict,
    lateDays,
    weeks,
    todayPlan,
    schedule,
    remainingByModule,
  };
}
