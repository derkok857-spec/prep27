import type { TopicId } from "./curriculum";
import type { ISODate } from "./dates";

export type Status = "todo" | "reading" | "done";
/** 1 low, 2 medium, 3 high */
export type Confidence = 1 | 2 | 3;
export type Letter = "A" | "B" | "C";
export type Difficulty = 1 | 2 | 3;

export interface CapacityChange {
  id: string;
  from: ISODate;
  to: ISODate;
  /** study hours per week while the change is active */
  hours: number;
  note: string;
}

export interface Profile {
  examDate: ISODate;
  weeklyHours: number;
  startDate: ISODate;
  mockWeeks: number;
  topicOrder: TopicId[];
  capacityChanges: CapacityChange[];
  targetHours: number;
}

export interface Reviews {
  r1?: ISODate;
  r7?: ISODate;
  r30?: ISODate;
}

export interface ModuleProgress {
  moduleId: number;
  status: Status;
  confidence: Confidence | null;
  doneAt: ISODate | null;
  reviews: Reviews;
  notes: string;
  hoursOverride: number | null;
}

export type SessionKind = "learn" | "review";

export interface StudySession {
  id: string;
  day: ISODate;
  minutes: number;
  moduleId: number | null;
  kind: SessionKind;
  note: string;
}

export type PracticeSource = "qbank" | "topic_test" | "mock" | "lab" | "other";

export interface PracticeAttempt {
  id: string;
  day: ISODate;
  moduleId: number | null;
  topicId: TopicId | null;
  questions: number;
  correct: number;
  minutes: number | null;
  source: PracticeSource;
}

export type ErrorType = "concept" | "formula" | "calc" | "misread" | "trap" | "time";
export type Certainty = "sure" | "unsure" | "guess";
export type MistakeSource = PracticeSource | "reading";

export interface MistakeCheck {
  day: ISODate;
  ok: boolean;
}

export interface Mistake {
  id: string;
  moduleId: number;
  createdOn: ISODate;
  description: string;
  lesson: string;
  errorType: ErrorType;
  certainty: Certainty | null;
  source: MistakeSource;
  nextReview: ISODate | null;
  streak: number;
  resolvedOn: ISODate | null;
  questionId: string | null;
  history: MistakeCheck[];
}

export interface Pattern {
  title: string;
  detail: string;
  evidence: string[];
  modules: number[];
  action: string;
}

export interface BatchMeta {
  discarded?: number;
  skipped?: { moduleId: number; reason: string }[];
  servedRequests?: string[];
  runKey?: string;
}

export interface AiBatch {
  id: string;
  createdAt: string;
  summary: string;
  patterns: Pattern[];
  meta: BatchMeta;
}

export type QuestionOrigin = "request" | "mistake" | "weak" | "starter";
export type Verification = "python" | "blind";

export interface AiQuestion {
  id: string;
  batchId: string;
  moduleId: number;
  difficulty: Difficulty;
  origin: QuestionOrigin;
  ref: string | null;
  stem: string;
  options: Record<Letter, string>;
  answer: Letter;
  explanation: string;
  verification: Verification;
  createdAt: string;
}

export interface QuestionAnswer {
  id: string;
  questionId: string;
  day: ISODate;
  pick: Letter;
  correct: boolean;
  certainty: Certainty | null;
}

export interface QuestionRequest {
  id: string;
  createdOn: ISODate;
  topicId: TopicId | null;
  moduleId: number | null;
  difficulty: Difficulty;
  count: number;
  note: string;
  servedBatchId: string | null;
}

export interface QuestionReport {
  id: string;
  questionId: string;
  day: ISODate;
  reason: string;
}

export interface Dataset {
  profile: Profile;
  progress: Record<number, ModuleProgress>;
  sessions: StudySession[];
  attempts: PracticeAttempt[];
  mistakes: Mistake[];
  batches: AiBatch[];
  questions: AiQuestion[];
  answers: QuestionAnswer[];
  requests: QuestionRequest[];
  reports: QuestionReport[];
}

export const ERROR_TYPES: { id: ErrorType; label: string; hint: string }[] = [
  { id: "concept", label: "Concept gap", hint: "Did not know or misunderstood the idea" },
  { id: "formula", label: "Formula", hint: "Wrong or forgotten formula" },
  { id: "calc", label: "Calculation", hint: "Arithmetic or calculator slip" },
  { id: "misread", label: "Misread", hint: "Missed a word like NOT, most likely, annual" },
  { id: "trap", label: "Distractor", hint: "Fell for a plausible wrong option" },
  { id: "time", label: "Time pressure", hint: "Rushed or guessed to save time" },
];

export const CERTAINTY: { id: Certainty; label: string }[] = [
  { id: "sure", label: "Sure" },
  { id: "unsure", label: "Unsure" },
  { id: "guess", label: "Guess" },
];

export const PRACTICE_SOURCES: { id: PracticeSource; label: string }[] = [
  { id: "qbank", label: "Question bank" },
  { id: "topic_test", label: "Topic test" },
  { id: "mock", label: "Mock exam" },
  { id: "lab", label: "Lab" },
  { id: "other", label: "Other" },
];

export const CONFIDENCE_LABEL: Record<Confidence, string> = { 1: "Low", 2: "Medium", 3: "High" };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };
export const LETTERS: Letter[] = ["A", "B", "C"];

export function errorTypeLabel(t: ErrorType): string {
  return ERROR_TYPES.find((e) => e.id === t)?.label ?? t;
}

export function sourceLabel(s: MistakeSource): string {
  if (s === "reading") return "Reading";
  return PRACTICE_SOURCES.find((e) => e.id === s)?.label ?? s;
}
