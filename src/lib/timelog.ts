import { addDays, startOfWeek, type ISODate } from "./dates";
import type { Dataset } from "./types";

/** CFA pacing is about 90 seconds a question, so a Lab answer counts as 1.5 minutes of practice. */
export const LAB_MINUTES_PER_QUESTION = 1.5;

export type TimeKind = "learn" | "review" | "practice";

export interface TimeEntry {
  day: ISODate;
  moduleId: number | null;
  minutes: number;
  kind: TimeKind;
}

export function timeEntries(ds: Pick<Dataset, "sessions" | "attempts" | "answers" | "questions">): TimeEntry[] {
  const out: TimeEntry[] = [];
  for (const s of ds.sessions) {
    out.push({ day: s.day, moduleId: s.moduleId, minutes: s.minutes, kind: s.kind });
  }
  for (const a of ds.attempts) {
    if (a.minutes != null && a.minutes > 0) {
      out.push({ day: a.day, moduleId: a.moduleId, minutes: a.minutes, kind: "practice" });
    }
  }
  const qs = new Map(ds.questions.map((q) => [q.id, q]));
  for (const an of ds.answers) {
    const q = qs.get(an.questionId);
    out.push({ day: an.day, moduleId: q?.moduleId ?? null, minutes: LAB_MINUTES_PER_QUESTION, kind: "practice" });
  }
  return out;
}

export function minutesByDay(entries: TimeEntry[]): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  for (const e of entries) out.set(e.day, (out.get(e.day) ?? 0) + e.minutes);
  return out;
}

export function minutesByModule(entries: TimeEntry[], asOf?: ISODate): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of entries) {
    if (e.moduleId == null) continue;
    if (asOf && e.day > asOf) continue;
    out.set(e.moduleId, (out.get(e.moduleId) ?? 0) + e.minutes);
  }
  return out;
}

export function hoursBetween(entries: TimeEntry[], from: ISODate, to: ISODate): number {
  let m = 0;
  for (const e of entries) if (e.day >= from && e.day <= to) m += e.minutes;
  return m / 60;
}

export interface WeekHours {
  start: ISODate;
  learn: number;
  review: number;
  practice: number;
  total: number;
}

export function hoursByWeek(entries: TimeEntry[], from: ISODate, to: ISODate): WeekHours[] {
  const first = startOfWeek(from);
  const last = startOfWeek(to);
  const weeks = new Map<ISODate, WeekHours>();
  for (let w = first; w <= last; w = addDays(w, 7)) {
    weeks.set(w, { start: w, learn: 0, review: 0, practice: 0, total: 0 });
  }
  for (const e of entries) {
    const row = weeks.get(startOfWeek(e.day));
    if (!row) continue;
    const h = e.minutes / 60;
    row[e.kind] += h;
    row.total += h;
  }
  return [...weeks.values()];
}
