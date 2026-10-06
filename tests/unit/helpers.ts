import { emptyDataset, emptyProgress } from "@/lib/defaults";
import type { ISODate } from "@/lib/dates";
import { firstReview } from "@/lib/srs";
import type { AiQuestion, Dataset, Mistake, ModuleProgress, PracticeAttempt, Profile, QuestionAnswer, StudySession } from "@/lib/types";

let n = 0;
const id = (p: string) => `${p}${++n}`;

export function makeDs(today: ISODate, profile: Partial<Profile> = {}): Dataset {
  const ds = emptyDataset(today);
  ds.profile = { ...ds.profile, ...profile };
  return ds;
}

export function setProgress(ds: Dataset, moduleId: number, patch: Partial<ModuleProgress>): ModuleProgress {
  const p = { ...emptyProgress(moduleId), ...ds.progress[moduleId], ...patch };
  ds.progress[moduleId] = p;
  return p;
}

export function attempt(p: Partial<PracticeAttempt> & { day: ISODate; questions: number; correct: number }): PracticeAttempt {
  return { id: id("a"), moduleId: null, topicId: null, minutes: null, source: "qbank", ...p };
}

export function session(p: Partial<StudySession> & { day: ISODate; minutes: number }): StudySession {
  return { id: id("s"), moduleId: null, kind: "learn", note: "", ...p };
}

export function mistake(p: Partial<Mistake> & { moduleId: number; createdOn: ISODate }): Mistake {
  return {
    id: id("m"),
    description: "x",
    lesson: "",
    errorType: "concept",
    certainty: null,
    source: "qbank",
    nextReview: firstReview(p.createdOn),
    streak: 0,
    resolvedOn: null,
    questionId: null,
    history: [],
    ...p,
  };
}

export function question(p: Partial<AiQuestion> & { moduleId: number }): AiQuestion {
  return {
    id: id("q"),
    batchId: "b1",
    difficulty: 2,
    origin: "weak",
    ref: null,
    stem: "Stem",
    options: { A: "a", B: "b", C: "c" },
    answer: "A",
    explanation: "",
    verification: "blind",
    createdAt: "2026-10-04T00:00:00Z",
    ...p,
  };
}

export function answer(p: Partial<QuestionAnswer> & { questionId: string; day: ISODate; correct: boolean }): QuestionAnswer {
  return { id: id("ans"), pick: p.correct ? "A" : "B", certainty: null, ...p };
}
