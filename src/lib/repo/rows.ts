// Mapping between database rows (snake_case, Postgres types) and domain objects.
// Shared by the browser repository and the worker routes.

import { isModuleId, isTopicId } from "../curriculum";
import { isISODate, type ISODate } from "../dates";
import { normalizeProfile } from "../defaults";
import type {
  AiBatch,
  AiQuestion,
  Certainty,
  Confidence,
  Difficulty,
  ErrorType,
  Letter,
  Mistake,
  MistakeCheck,
  MistakeSource,
  ModuleProgress,
  Pattern,
  PracticeAttempt,
  PracticeSource,
  Profile,
  QuestionAnswer,
  QuestionReport,
  QuestionRequest,
  Reviews,
  StudySession,
} from "../types";

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown, dflt = ""): string => (typeof v === "string" ? v : v == null ? dflt : String(v));
const day = (v: unknown): ISODate | null => {
  const s = typeof v === "string" ? v.slice(0, 10) : null;
  return s && isISODate(s) ? s : null;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (allowed.includes(v as T) ? (v as T) : dflt);
const maybeOneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (allowed.includes(v as T) ? (v as T) : null);

const CERTAINTIES = ["sure", "unsure", "guess"] as const;
const SOURCES = ["qbank", "topic_test", "mock", "lab", "other"] as const;
const MISTAKE_SOURCES = [...SOURCES, "reading"] as const;
const ERRORS = ["concept", "formula", "calc", "misread", "trap", "time"] as const;
const LETTERS = ["A", "B", "C"] as const;

// ---------- profile ----------

export function profileFromRow(r: Row | null | undefined, today: ISODate): Profile {
  if (!r) return normalizeProfile(null, today);
  return normalizeProfile(
    {
      examDate: day(r.exam_date) ?? undefined,
      weeklyHours: num(r.weekly_hours) ?? undefined,
      startDate: day(r.start_date) ?? undefined,
      mockWeeks: num(r.mock_weeks) ?? undefined,
      topicOrder: Array.isArray(r.topic_order) ? (r.topic_order as Profile["topicOrder"]) : undefined,
      capacityChanges: Array.isArray(r.capacity_changes) ? (r.capacity_changes as Profile["capacityChanges"]) : undefined,
      targetHours: num(r.target_hours) ?? undefined,
    },
    today,
  );
}

export function profileToRow(p: Profile): Row {
  return {
    exam_date: p.examDate,
    weekly_hours: p.weeklyHours,
    start_date: p.startDate,
    mock_weeks: p.mockWeeks,
    topic_order: p.topicOrder,
    capacity_changes: p.capacityChanges,
    target_hours: p.targetHours,
  };
}

// ---------- module progress ----------

function reviewsFrom(v: unknown): Reviews {
  const out: Reviews = {};
  if (v && typeof v === "object") {
    for (const k of ["r1", "r7", "r30"] as const) {
      const d = day((v as Row)[k]);
      if (d) out[k] = d;
    }
  }
  return out;
}

export function progressFromRow(r: Row): ModuleProgress | null {
  const moduleId = num(r.module_id);
  if (moduleId == null || !isModuleId(moduleId)) return null;
  const c = num(r.confidence);
  return {
    moduleId,
    status: oneOf(r.status, ["todo", "reading", "done"] as const, "todo"),
    confidence: c === 1 || c === 2 || c === 3 ? (c as Confidence) : null,
    doneAt: day(r.done_at),
    reviews: reviewsFrom(r.reviews),
    notes: str(r.notes),
    hoursOverride: num(r.hours_override),
  };
}

export function progressToRow(p: ModuleProgress): Row {
  return {
    module_id: p.moduleId,
    status: p.status,
    confidence: p.confidence,
    done_at: p.doneAt,
    reviews: p.reviews,
    notes: p.notes,
    hours_override: p.hoursOverride,
  };
}

// ---------- sessions and attempts ----------

export function sessionFromRow(r: Row): StudySession | null {
  const d = day(r.day);
  const minutes = num(r.minutes);
  if (!d || minutes == null) return null;
  const mod = num(r.module_id);
  return {
    id: str(r.id),
    day: d,
    minutes,
    moduleId: mod != null && isModuleId(mod) ? mod : null,
    kind: oneOf(r.kind, ["learn", "review"] as const, "learn"),
    note: str(r.note),
  };
}

export function sessionToRow(s: StudySession): Row {
  return { id: s.id, day: s.day, minutes: Math.round(s.minutes), module_id: s.moduleId, kind: s.kind, note: s.note };
}

export function attemptFromRow(r: Row): PracticeAttempt | null {
  const d = day(r.day);
  const questions = num(r.questions);
  const correct = num(r.correct);
  if (!d || questions == null || correct == null) return null;
  const mod = num(r.module_id);
  return {
    id: str(r.id),
    day: d,
    moduleId: mod != null && isModuleId(mod) ? mod : null,
    topicId: isTopicId(r.topic_id) ? r.topic_id : null,
    questions,
    correct,
    minutes: num(r.minutes),
    source: oneOf<PracticeSource>(r.source, SOURCES, "qbank"),
  };
}

export function attemptToRow(a: PracticeAttempt): Row {
  return {
    id: a.id,
    day: a.day,
    module_id: a.moduleId,
    topic_id: a.moduleId != null ? null : a.topicId,
    questions: a.questions,
    correct: a.correct,
    minutes: a.minutes != null && a.minutes > 0 ? Math.round(a.minutes) : null,
    source: a.source,
  };
}

// ---------- mistakes ----------

function historyFrom(v: unknown): MistakeCheck[] {
  if (!Array.isArray(v)) return [];
  return v.map((h) => ({ day: day((h as Row)?.day), ok: Boolean((h as Row)?.ok) })).filter((h): h is MistakeCheck => h.day != null);
}

export function mistakeFromRow(r: Row): Mistake | null {
  const mod = num(r.module_id);
  const created = day(r.created_on);
  if (mod == null || !isModuleId(mod) || !created) return null;
  return {
    id: str(r.id),
    moduleId: mod,
    createdOn: created,
    description: str(r.description),
    lesson: str(r.lesson),
    errorType: oneOf<ErrorType>(r.error_type, ERRORS, "concept"),
    certainty: maybeOneOf<Certainty>(r.certainty, CERTAINTIES),
    source: oneOf<MistakeSource>(r.source, MISTAKE_SOURCES, "qbank"),
    nextReview: day(r.next_review),
    streak: num(r.streak) ?? 0,
    resolvedOn: day(r.resolved_on),
    questionId: r.question_id ? str(r.question_id) : null,
    history: historyFrom(r.history),
  };
}

export function mistakeToRow(m: Mistake): Row {
  return {
    id: m.id,
    module_id: m.moduleId,
    created_on: m.createdOn,
    description: m.description,
    lesson: m.lesson,
    error_type: m.errorType,
    certainty: m.certainty,
    source: m.source,
    next_review: m.nextReview,
    streak: m.streak,
    resolved_on: m.resolvedOn,
    question_id: m.questionId,
    history: m.history,
  };
}

// ---------- AI ----------

function patternsFrom(v: unknown): Pattern[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const o = p as Row;
      return {
        title: str(o.title),
        detail: str(o.detail),
        evidence: Array.isArray(o.evidence) ? o.evidence.map((x) => str(x)) : [],
        modules: Array.isArray(o.modules) ? o.modules.map((x) => num(x)).filter((x): x is number => x != null && isModuleId(x)) : [],
        action: str(o.action),
      };
    })
    .filter((p) => p.title);
}

export function batchFromRow(r: Row): AiBatch {
  const meta = r.meta && typeof r.meta === "object" ? (r.meta as Row) : {};
  return {
    id: str(r.id),
    createdAt: str(r.created_at),
    summary: str(r.summary),
    patterns: patternsFrom(r.patterns),
    meta: {
      discarded: num(meta.discarded) ?? undefined,
      skipped: Array.isArray(meta.skipped)
        ? (meta.skipped as Row[])
            .map((s) => ({ moduleId: num(s?.moduleId) ?? 0, reason: str(s?.reason) }))
            .filter((s) => isModuleId(s.moduleId))
        : undefined,
      servedRequests: Array.isArray(meta.servedRequests) ? meta.servedRequests.map((x) => str(x)) : undefined,
      runKey: r.run_key ? str(r.run_key) : undefined,
    },
  };
}

export function questionFromRow(r: Row): AiQuestion | null {
  const mod = num(r.module_id);
  const o = r.options && typeof r.options === "object" ? (r.options as Row) : null;
  const answer = maybeOneOf<Letter>(r.answer, LETTERS);
  if (mod == null || !isModuleId(mod) || !o || !answer) return null;
  const d = num(r.difficulty);
  return {
    id: str(r.id),
    batchId: str(r.batch_id),
    moduleId: mod,
    difficulty: (d === 1 || d === 2 || d === 3 ? d : 2) as Difficulty,
    origin: oneOf(r.origin, ["request", "mistake", "weak", "starter"] as const, "weak"),
    ref: r.ref ? str(r.ref) : null,
    stem: str(r.stem),
    options: { A: str(o.A), B: str(o.B), C: str(o.C) },
    answer,
    explanation: str(r.explanation),
    verification: oneOf(r.verification, ["python", "blind"] as const, "blind"),
    createdAt: str(r.created_at),
  };
}

export function answerFromRow(r: Row): QuestionAnswer | null {
  const d = day(r.day);
  const pick = maybeOneOf<Letter>(r.pick, LETTERS);
  if (!d || !pick || !r.question_id) return null;
  return {
    id: str(r.id),
    questionId: str(r.question_id),
    day: d,
    pick,
    correct: Boolean(r.correct),
    certainty: maybeOneOf<Certainty>(r.certainty, CERTAINTIES),
  };
}

export function answerToRow(a: QuestionAnswer): Row {
  return { id: a.id, question_id: a.questionId, day: a.day, pick: a.pick, correct: a.correct, certainty: a.certainty };
}

export function requestFromRow(r: Row): QuestionRequest | null {
  const d = day(r.created_on);
  if (!d) return null;
  const mod = num(r.module_id);
  const diff = num(r.difficulty);
  return {
    id: str(r.id),
    createdOn: d,
    topicId: isTopicId(r.topic_id) ? r.topic_id : null,
    moduleId: mod != null && isModuleId(mod) ? mod : null,
    difficulty: (diff === 1 || diff === 2 || diff === 3 ? diff : 2) as Difficulty,
    count: num(r.count) ?? 8,
    note: str(r.note),
    servedBatchId: r.served_batch_id ? str(r.served_batch_id) : null,
  };
}

export function requestToRow(q: QuestionRequest): Row {
  return {
    id: q.id,
    created_on: q.createdOn,
    topic_id: q.moduleId != null ? null : q.topicId,
    module_id: q.moduleId,
    difficulty: q.difficulty,
    count: q.count,
    note: q.note,
  };
}

export function reportFromRow(r: Row): QuestionReport | null {
  const d = day(r.day);
  if (!d || !r.question_id) return null;
  return { id: str(r.id), questionId: str(r.question_id), day: d, reason: str(r.reason) };
}

export function reportToRow(q: QuestionReport): Row {
  return { id: q.id, question_id: q.questionId, day: q.day, reason: q.reason };
}

export function compact<T>(list: (T | null)[]): T[] {
  return list.filter((x): x is T => x != null);
}
