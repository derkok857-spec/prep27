import { addDays, type ISODate } from "./dates";
import type { AiQuestion, Dataset, Difficulty, QuestionAnswer } from "./types";

export type QuestionState = "waiting" | "right" | "wrong" | "reported";

export function answersByQuestion(answers: QuestionAnswer[]): Map<string, QuestionAnswer[]> {
  const out = new Map<string, QuestionAnswer[]>();
  for (const a of answers) {
    const list = out.get(a.questionId);
    if (list) list.push(a);
    else out.set(a.questionId, [a]);
  }
  return out;
}

export function reportedIds(ds: Pick<Dataset, "reports">): Set<string> {
  return new Set(ds.reports.map((r) => r.questionId));
}

/** State follows the first answer. A retry never turns a miss into a hit. */
export function questionState(q: AiQuestion, byQ: Map<string, QuestionAnswer[]>, reported: Set<string>): QuestionState {
  if (reported.has(q.id)) return "reported";
  const first = byQ.get(q.id)?.[0];
  if (!first) return "waiting";
  return first.correct ? "right" : "wrong";
}

export function waitingQuestions(ds: Pick<Dataset, "questions" | "answers" | "reports">): AiQuestion[] {
  const byQ = answersByQuestion(ds.answers);
  const rep = reportedIds(ds);
  return ds.questions.filter((q) => questionState(q, byQ, rep) === "waiting");
}

export interface LabStats {
  answered: number;
  right: number;
  byDifficulty: Record<Difficulty, { answered: number; right: number }>;
}

export function labStats(ds: Pick<Dataset, "questions" | "answers" | "reports">): LabStats {
  const byQ = answersByQuestion(ds.answers);
  const rep = reportedIds(ds);
  const stats: LabStats = {
    answered: 0,
    right: 0,
    byDifficulty: { 1: { answered: 0, right: 0 }, 2: { answered: 0, right: 0 }, 3: { answered: 0, right: 0 } },
  };
  for (const q of ds.questions) {
    const s = questionState(q, byQ, rep);
    if (s !== "right" && s !== "wrong") continue;
    stats.answered++;
    stats.byDifficulty[q.difficulty].answered++;
    if (s === "right") {
      stats.right++;
      stats.byDifficulty[q.difficulty].right++;
    }
  }
  return stats;
}

/** Modules with three or more reports inside a 7 day span stay off the AI run for 14 days after the third report. */
export function skippedModules(ds: Pick<Dataset, "questions" | "reports">, today: ISODate): { moduleId: number; until: ISODate }[] {
  const qmap = new Map(ds.questions.map((q) => [q.id, q]));
  const days = new Map<number, ISODate[]>();
  for (const r of ds.reports) {
    const q = qmap.get(r.questionId);
    if (!q) continue;
    const list = days.get(q.moduleId);
    if (list) list.push(r.day);
    else days.set(q.moduleId, [r.day]);
  }
  const out: { moduleId: number; until: ISODate }[] = [];
  for (const [moduleId, list] of days) {
    list.sort();
    let until: ISODate | null = null;
    for (let i = 2; i < list.length; i++) {
      if (list[i] <= addDays(list[i - 2], 6)) {
        const u = addDays(list[i], 14);
        if (!until || u > until) until = u;
      }
    }
    if (until && until >= today) out.push({ moduleId, until });
  }
  return out;
}

export const ORIGIN_LABEL: Record<AiQuestion["origin"], string> = {
  request: "Your request",
  mistake: "From a mistake",
  weak: "Weak module",
  starter: "Starter set",
};
