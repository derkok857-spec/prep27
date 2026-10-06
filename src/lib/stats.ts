import { TOPICS, type TopicId } from "./curriculum";
import { addDays, startOfWeek, type ISODate } from "./dates";
import { allTopicStats, accuracy, masteryMap, readiness, type PracticeEvent } from "./mastery";
import { isOpen } from "./srs";
import type { TimeEntry } from "./timelog";
import type { Certainty, Dataset, ErrorType, Mistake } from "./types";

export function streakDays(byDay: Map<ISODate, number>, today: ISODate, minMinutes = 10): number {
  let d = today;
  if ((byDay.get(d) ?? 0) < minMinutes) d = addDays(d, -1);
  let n = 0;
  while ((byDay.get(d) ?? 0) >= minMinutes) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface TopicAccuracy {
  topic: TopicId;
  raw: number;
  rawN: number;
  rate: number | null;
}

export function accuracyByTopic(events: PracticeEvent[], asOf: ISODate, windowDays?: number): TopicAccuracy[] {
  return TOPICS.map((t) => {
    const a = accuracy(events, (e) => e.topicId === t.id, asOf, windowDays);
    return { topic: t.id, raw: a.raw, rawN: a.rawN, rate: a.rawN > 0 ? a.raw / a.rawN : null };
  });
}

export interface WeekAccuracy {
  start: ISODate;
  c: number;
  n: number;
}

export function accuracyByWeek(events: PracticeEvent[], from: ISODate, to: ISODate): WeekAccuracy[] {
  const rows = new Map<ISODate, WeekAccuracy>();
  for (let w = startOfWeek(from); w <= startOfWeek(to); w = addDays(w, 7)) rows.set(w, { start: w, c: 0, n: 0 });
  for (const e of events) {
    const r = rows.get(startOfWeek(e.day));
    if (!r) continue;
    r.c += e.c;
    r.n += e.n;
  }
  return [...rows.values()];
}

export interface ReadinessPoint {
  day: ISODate;
  value: number;
}

/** Readiness as it stood at the end of each week, replaying the log up to that day. */
export function readinessHistory(ds: Dataset, events: PracticeEvent[], from: ISODate, today: ISODate): ReadinessPoint[] {
  const out: ReadinessPoint[] = [];
  for (let w = startOfWeek(from); w <= today; w = addDays(w, 7)) {
    const asOf = addDays(w, 6) < today ? addDays(w, 6) : today;
    const mm = masteryMap(ds, asOf, events);
    out.push({ day: asOf, value: readiness(allTopicStats(mm, ds)) });
  }
  return out;
}

export interface MistakeBreakdown {
  byType: { type: ErrorType; open: number; total: number }[];
  byCertainty: Record<Certainty | "unknown", number>;
  open: number;
  resolved: number;
}

export function mistakeBreakdown(mistakes: Mistake[], since?: ISODate): MistakeBreakdown {
  const list = since ? mistakes.filter((m) => m.createdOn >= since) : mistakes;
  const types: ErrorType[] = ["concept", "formula", "calc", "misread", "trap", "time"];
  const byType = types.map((type) => ({
    type,
    open: list.filter((m) => m.errorType === type && isOpen(m)).length,
    total: list.filter((m) => m.errorType === type).length,
  }));
  const byCertainty: Record<Certainty | "unknown", number> = { sure: 0, unsure: 0, guess: 0, unknown: 0 };
  for (const m of list) byCertainty[m.certainty ?? "unknown"]++;
  return {
    byType,
    byCertainty,
    open: list.filter(isOpen).length,
    resolved: list.filter((m) => !isOpen(m)).length,
  };
}

export function totalHours(entries: TimeEntry[], asOf?: ISODate): number {
  let m = 0;
  for (const e of entries) if (!asOf || e.day <= asOf) m += e.minutes;
  return m / 60;
}

export function questionsSince(events: PracticeEvent[], since: ISODate, asOf: ISODate) {
  let c = 0;
  let n = 0;
  for (const e of events) {
    if (e.day < since || e.day > asOf) continue;
    c += e.c;
    n += e.n;
  }
  return { c, n, rate: n > 0 ? c / n : null };
}
