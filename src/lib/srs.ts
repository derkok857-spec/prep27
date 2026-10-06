// Spaced repetition. Mistakes come back after 3, 7 and 21 days and retire after three clean checks in a row.
// Finished modules get recall reviews one day, one week and one month after you finish them.

import { MODULES } from "./curriculum";
import { addDays, diffDays, maxDate, type ISODate } from "./dates";
import { progressOf } from "./defaults";
import type { Dataset, Mistake, ModuleProgress, Reviews } from "./types";

export const MISTAKE_STEPS = [3, 7, 21] as const;

export function firstReview(createdOn: ISODate): ISODate {
  return addDays(createdOn, MISTAKE_STEPS[0]);
}

export type MistakeUpdate = Pick<Mistake, "streak" | "nextReview" | "resolvedOn" | "history">;

export function recheckMistake(m: Mistake, ok: boolean, today: ISODate): MistakeUpdate {
  const history = [...m.history, { day: today, ok }];
  if (!ok) {
    return { streak: 0, nextReview: addDays(today, MISTAKE_STEPS[0]), resolvedOn: null, history };
  }
  const streak = m.streak + 1;
  if (streak >= MISTAKE_STEPS.length) {
    return { streak, nextReview: null, resolvedOn: today, history };
  }
  return { streak, nextReview: addDays(today, MISTAKE_STEPS[streak]), resolvedOn: null, history };
}

export function reopenMistake(m: Mistake, today: ISODate): MistakeUpdate {
  return { streak: 0, nextReview: addDays(today, MISTAKE_STEPS[0]), resolvedOn: null, history: m.history };
}

export function resolveMistake(m: Mistake, today: ISODate): MistakeUpdate {
  return { streak: m.streak, nextReview: null, resolvedOn: today, history: m.history };
}

export const isOpen = (m: Mistake) => m.resolvedOn == null;

export function dueMistakes(mistakes: Mistake[], today: ISODate): Mistake[] {
  return mistakes
    .filter((m) => isOpen(m) && m.nextReview != null && m.nextReview <= today)
    .sort((a, b) => (a.nextReview! < b.nextReview! ? -1 : a.nextReview! > b.nextReview! ? 1 : 0));
}

export const failedChecks = (m: Mistake) => m.history.filter((h) => !h.ok).length;

export type ReviewKey = keyof Reviews;
export const REVIEW_KEYS: ReviewKey[] = ["r1", "r7", "r30"];
export const REVIEW_OFFSET: Record<ReviewKey, number> = { r1: 1, r7: 7, r30: 30 };
const MIN_GAP: Record<ReviewKey, number> = { r1: 0, r7: 3, r30: 7 };

export interface ReviewSlot {
  key: ReviewKey;
  due: ISODate;
  doneOn: ISODate | null;
}

/** Review k waits for review k-1, and never lands sooner than a few days after it. */
export function reviewSlots(p: ModuleProgress): ReviewSlot[] {
  if (p.status !== "done" || !p.doneAt) return [];
  const out: ReviewSlot[] = [];
  let prev: ISODate | null = null;
  for (const key of REVIEW_KEYS) {
    let due = addDays(p.doneAt, REVIEW_OFFSET[key]);
    if (prev) due = maxDate(due, addDays(prev, MIN_GAP[key]));
    const doneOn = p.reviews[key] ?? null;
    out.push({ key, due, doneOn });
    prev = doneOn ?? due;
  }
  return out;
}

export function nextReview(p: ModuleProgress): ReviewSlot | null {
  return reviewSlots(p).find((s) => !s.doneOn) ?? null;
}

export interface DueReview {
  moduleId: number;
  key: ReviewKey;
  due: ISODate;
  overdueDays: number;
}

export function dueReviews(ds: Pick<Dataset, "progress">, today: ISODate): DueReview[] {
  const out: DueReview[] = [];
  for (const m of MODULES) {
    const slot = nextReview(progressOf(ds, m.id));
    if (slot && slot.due <= today) {
      out.push({ moduleId: m.id, key: slot.key, due: slot.due, overdueDays: diffDays(slot.due, today) });
    }
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays || a.moduleId - b.moduleId);
}

export function upcomingReviews(ds: Pick<Dataset, "progress">, today: ISODate, days: number): DueReview[] {
  const until = addDays(today, days);
  const out: DueReview[] = [];
  for (const m of MODULES) {
    const slot = nextReview(progressOf(ds, m.id));
    if (slot && slot.due > today && slot.due <= until) {
      out.push({ moduleId: m.id, key: slot.key, due: slot.due, overdueDays: diffDays(slot.due, today) });
    }
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : 1));
}

export const REVIEW_LABEL: Record<ReviewKey, string> = {
  r1: "1-day review",
  r7: "1-week review",
  r30: "1-month review",
};
