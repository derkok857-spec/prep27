import { MODULES, TOPICS, baseHours, getModule, modulesOf, weightMid, type TopicId } from "./curriculum";
import { diffDays, type ISODate } from "./dates";
import { progressOf } from "./defaults";
import type { Confidence, Dataset, ModuleProgress, PracticeSource, Profile } from "./types";

/** Practice older than this many days counts half as much. */
export const HALF_LIFE_DAYS = 21;
export const CONFIDENCE_VALUE: Record<Confidence, number> = { 1: 0.25, 2: 0.6, 3: 1 };
export const BAND_LOW = 0.55;
export const BAND_HIGH = 0.65;

export interface PracticeEvent {
  day: ISODate;
  moduleId: number | null;
  topicId: TopicId | null;
  n: number;
  c: number;
  source: PracticeSource;
}

/** Logged practice blocks plus the first answer to every Lab question. Retries after seeing the key do not count. */
export function practiceEvents(ds: Pick<Dataset, "attempts" | "answers" | "questions">): PracticeEvent[] {
  const out: PracticeEvent[] = [];
  for (const a of ds.attempts) {
    const topic = a.moduleId != null ? (getModule(a.moduleId)?.topic ?? null) : a.topicId;
    out.push({ day: a.day, moduleId: a.moduleId, topicId: topic, n: a.questions, c: a.correct, source: a.source });
  }
  const qs = new Map(ds.questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  for (const an of ds.answers) {
    if (seen.has(an.questionId)) continue;
    const q = qs.get(an.questionId);
    if (!q) continue;
    seen.add(an.questionId);
    out.push({
      day: an.day,
      moduleId: q.moduleId,
      topicId: getModule(q.moduleId)?.topic ?? null,
      n: 1,
      c: an.correct ? 1 : 0,
      source: "lab",
    });
  }
  return out;
}

export interface Accuracy {
  /** recency weighted */
  c: number;
  n: number;
  /** plain counts */
  raw: number;
  rawN: number;
}

export function accuracy(events: PracticeEvent[], match: (e: PracticeEvent) => boolean, asOf: ISODate, windowDays?: number): Accuracy {
  let c = 0;
  let n = 0;
  let raw = 0;
  let rawN = 0;
  for (const e of events) {
    if (e.day > asOf || !match(e)) continue;
    const age = Math.max(0, diffDays(e.day, asOf));
    if (windowDays != null && age >= windowDays) continue;
    const w = Math.pow(0.5, age / HALF_LIFE_DAYS);
    c += w * e.c;
    n += w * e.n;
    raw += e.c;
    rawN += e.n;
  }
  return { c, n, raw, rawN };
}

export const rate = (a: Pick<Accuracy, "raw" | "rawN">): number | null => (a.rawN > 0 ? a.raw / a.rawN : null);

/** Progress as it stood on a past day, for history charts. */
export function progressAsOf(p: ModuleProgress, asOf: ISODate): ModuleProgress {
  const done = p.status === "done" && (p.doneAt == null || p.doneAt <= asOf);
  const reviews: ModuleProgress["reviews"] = {};
  if (done) {
    for (const k of ["r1", "r7", "r30"] as const) {
      const d = p.reviews[k];
      if (d && d <= asOf) reviews[k] = d;
    }
  }
  return {
    ...p,
    status: done ? "done" : p.status === "done" ? "reading" : p.status,
    confidence: done || p.status !== "done" ? p.confidence : null,
    reviews,
  };
}

export function reviewsDone(p: ModuleProgress): number {
  return (p.reviews.r1 ? 1 : 0) + (p.reviews.r7 ? 1 : 0) + (p.reviews.r30 ? 1 : 0);
}

/**
 * 60% practice accuracy (Laplace smoothed, recency weighted), 20% self-rated confidence,
 * 20% spaced reviews completed. Null means there is nothing to judge yet.
 */
export function masteryValue(p: ModuleProgress, acc: Accuracy): number | null {
  if (!(acc.rawN > 0 || p.status === "done" || p.confidence != null)) return null;
  const a = (acc.c + 2) / (acc.n + 4);
  const conf = p.confidence != null ? CONFIDENCE_VALUE[p.confidence] : 0.5;
  const rev = p.status === "done" ? reviewsDone(p) / 3 : 0;
  return Math.max(0, Math.min(1, 0.6 * a + 0.2 * conf + 0.2 * rev));
}

export type Band = "none" | "low" | "mid" | "high";

export function band(v: number | null | undefined): Band {
  if (v == null) return "none";
  if (v < BAND_LOW) return "low";
  if (v < BAND_HIGH) return "mid";
  return "high";
}

export interface ModuleMastery {
  moduleId: number;
  mastery: number | null;
  acc: Accuracy;
  acc28: Accuracy;
  hours: number;
}

export function moduleHours(p: ModuleProgress, profile: Pick<Profile, "targetHours">): number {
  if (p.hoursOverride != null && p.hoursOverride >= 0) return p.hoursOverride;
  return baseHours(p.moduleId, profile.targetHours);
}

export function masteryMap(
  ds: Pick<Dataset, "progress" | "attempts" | "answers" | "questions" | "profile">,
  asOf: ISODate,
  events: PracticeEvent[] = practiceEvents(ds),
): Map<number, ModuleMastery> {
  const byModule = new Map<number, PracticeEvent[]>();
  for (const e of events) {
    if (e.moduleId == null) continue;
    const list = byModule.get(e.moduleId);
    if (list) list.push(e);
    else byModule.set(e.moduleId, [e]);
  }
  const out = new Map<number, ModuleMastery>();
  for (const m of MODULES) {
    const current = progressOf(ds, m.id);
    const p = progressAsOf(current, asOf);
    const evs = byModule.get(m.id) ?? [];
    const acc = accuracy(evs, () => true, asOf);
    const acc28 = accuracy(evs, () => true, asOf, 28);
    out.set(m.id, {
      moduleId: m.id,
      mastery: masteryValue(p, acc),
      acc,
      acc28,
      hours: moduleHours(current, ds.profile),
    });
  }
  return out;
}

export interface TopicStats {
  topic: TopicId;
  weight: number;
  /** hours weighted mean over modules with data */
  mastery: number | null;
  /** share of topic hours that has any mastery signal */
  coverage: number;
  /** share of topic hours marked done */
  doneShare: number;
  modulesDone: number;
  modulesTotal: number;
  /** topic contribution to readiness, 0..1 */
  score: number;
}

export function topicStats(topic: TopicId, mm: Map<number, ModuleMastery>, ds: Pick<Dataset, "progress">): TopicStats {
  const mods = modulesOf(topic);
  let hT = 0;
  let hU = 0;
  let mw = 0;
  let hDone = 0;
  let nDone = 0;
  for (const m of mods) {
    const info = mm.get(m.id);
    const h = Math.max(info?.hours ?? 0, 0.25);
    hT += h;
    if (info?.mastery != null) {
      hU += h;
      mw += info.mastery * h;
    }
    if (progressOf(ds, m.id).status === "done") {
      hDone += h;
      nDone++;
    }
  }
  const t = TOPICS.find((x) => x.id === topic)!;
  return {
    topic,
    weight: weightMid(t),
    mastery: hU > 0 ? mw / hU : null,
    coverage: hT > 0 ? hU / hT : 0,
    doneShare: hT > 0 ? hDone / hT : 0,
    modulesDone: nDone,
    modulesTotal: mods.length,
    score: hT > 0 ? mw / hT : 0,
  };
}

export function allTopicStats(mm: Map<number, ModuleMastery>, ds: Pick<Dataset, "progress">): TopicStats[] {
  return TOPICS.map((t) => topicStats(t.id, mm, ds));
}

/** Exam weighted share of the curriculum you can currently back up with evidence. Untouched modules count as zero. */
export function readiness(stats: TopicStats[]): number {
  let s = 0;
  let w = 0;
  for (const t of stats) {
    s += t.weight * t.score;
    w += t.weight;
  }
  return w > 0 ? s / w : 0;
}
