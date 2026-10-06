import { getModule, getTopic, weightMid } from "./curriculum";
import { diffDays, type ISODate } from "./dates";
import { progressOf } from "./defaults";
import { BAND_HIGH, type ModuleMastery } from "./mastery";
import { waitingQuestions } from "./lab";
import type { Dataset } from "./types";

export function lastContact(
  ds: Pick<Dataset, "progress" | "attempts" | "sessions" | "answers" | "questions">,
  moduleId: number,
): ISODate | null {
  let d: ISODate | null = progressOf(ds, moduleId).doneAt;
  const bump = (x: ISODate) => {
    if (!d || x > d) d = x;
  };
  for (const a of ds.attempts) if (a.moduleId === moduleId) bump(a.day);
  for (const s of ds.sessions) if (s.moduleId === moduleId) bump(s.day);
  const qs = new Set(ds.questions.filter((q) => q.moduleId === moduleId).map((q) => q.id));
  for (const an of ds.answers) if (qs.has(an.questionId)) bump(an.day);
  return d;
}

export interface WeakModule {
  moduleId: number;
  mastery: number;
  priority: number;
  lastContact: ISODate | null;
  labWaiting: number;
}

/** Weak spots worth fixing, ranked by exam weight, how weak they are and how long since you touched them. */
export function weakModules(ds: Dataset, today: ISODate, mm: Map<number, ModuleMastery>, limit = 5): WeakModule[] {
  const waiting = waitingQuestions(ds);
  const out: WeakModule[] = [];
  for (const info of mm.values()) {
    if (info.mastery == null || info.mastery >= BAND_HIGH) continue;
    const m = getModule(info.moduleId);
    if (!m) continue;
    const touched = lastContact(ds, m.id);
    const days = touched ? Math.max(0, diffDays(touched, today)) : 30;
    const w = weightMid(getTopic(m.topic));
    out.push({
      moduleId: m.id,
      mastery: info.mastery,
      priority: w * (1 - info.mastery) * (1 + days / 30),
      lastContact: touched,
      labWaiting: waiting.filter((q) => q.moduleId === m.id).length,
    });
  }
  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
