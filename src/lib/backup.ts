// JSON backups of the whole dataset. Import is defensive: anything malformed is dropped, never trusted.

import { isModuleId, isTopicId } from "./curriculum";
import { isISODate, type ISODate } from "./dates";
import { normalizeProfile } from "./defaults";
import type {
  AiBatch,
  AiQuestion,
  Dataset,
  Mistake,
  ModuleProgress,
  PracticeAttempt,
  QuestionAnswer,
  QuestionReport,
  QuestionRequest,
  StudySession,
} from "./types";

export const BACKUP_APP = "prep27";
export const BACKUP_VERSION = 1;

export function exportBackup(ds: Dataset, now = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: ds }, null, 2);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);
const id = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{8,64}$/i.test(v) ? v : null);
const LETTERS = ["A", "B", "C"];

export class BackupError extends Error {}

export function parseBackup(text: string, today: ISODate): Dataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("That file is not valid JSON.");
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data)) throw new BackupError("That file is not a Prep27 backup.");
  const d = raw.data;

  const progress: Record<number, ModuleProgress> = {};
  if (isObj(d.progress)) {
    for (const p of Object.values(d.progress)) {
      if (!isObj(p) || !isModuleId(p.moduleId)) continue;
      const status = p.status === "done" || p.status === "reading" ? p.status : "todo";
      const c = int(p.confidence);
      const reviews: ModuleProgress["reviews"] = {};
      if (isObj(p.reviews)) for (const k of ["r1", "r7", "r30"] as const) if (isISODate(p.reviews[k])) reviews[k] = p.reviews[k] as string;
      progress[p.moduleId] = {
        moduleId: p.moduleId,
        status,
        confidence: c === 1 || c === 2 || c === 3 ? c : null,
        doneAt: isISODate(p.doneAt) ? p.doneAt : null,
        reviews,
        notes: str(p.notes),
        hoursOverride: typeof p.hoursOverride === "number" && p.hoursOverride >= 0 && p.hoursOverride <= 100 ? p.hoursOverride : null,
      };
    }
  }

  const sessions: StudySession[] = arr(d.sessions).flatMap((s) => {
    const sid = id(s.id);
    const minutes = int(s.minutes);
    if (!sid || !isISODate(s.day) || minutes == null || minutes < 1 || minutes > 960) return [];
    return [
      {
        id: sid,
        day: s.day,
        minutes,
        moduleId: isModuleId(s.moduleId) ? s.moduleId : null,
        kind: s.kind === "review" ? "review" : "learn",
        note: str(s.note, 500),
      },
    ];
  });

  const attempts: PracticeAttempt[] = arr(d.attempts).flatMap((a) => {
    const aid = id(a.id);
    const n = int(a.questions);
    const c = int(a.correct);
    if (!aid || !isISODate(a.day) || n == null || c == null || n < 1 || c < 0 || c > n) return [];
    const mod = isModuleId(a.moduleId) ? a.moduleId : null;
    const topic = isTopicId(a.topicId) ? a.topicId : null;
    if (mod == null && topic == null) return [];
    const src = ["qbank", "topic_test", "mock", "lab", "other"].includes(String(a.source))
      ? (a.source as PracticeAttempt["source"])
      : "other";
    const min = int(a.minutes);
    return [
      {
        id: aid,
        day: a.day,
        moduleId: mod,
        topicId: mod ? null : topic,
        questions: n,
        correct: c,
        minutes: min && min > 0 ? min : null,
        source: src,
      },
    ];
  });

  const mistakes: Mistake[] = arr(d.mistakes).flatMap((m) => {
    const mid = id(m.id);
    if (!mid || !isModuleId(m.moduleId) || !isISODate(m.createdOn) || !str(m.description)) return [];
    const types = ["concept", "formula", "calc", "misread", "trap", "time"];
    return [
      {
        id: mid,
        moduleId: m.moduleId,
        createdOn: m.createdOn,
        description: str(m.description, 1000),
        lesson: str(m.lesson, 1000),
        errorType: (types.includes(String(m.errorType)) ? m.errorType : "concept") as Mistake["errorType"],
        certainty: ["sure", "unsure", "guess"].includes(String(m.certainty)) ? (m.certainty as Mistake["certainty"]) : null,
        source: (["qbank", "topic_test", "mock", "lab", "other", "reading"].includes(String(m.source))
          ? m.source
          : "other") as Mistake["source"],
        nextReview: isISODate(m.nextReview) ? m.nextReview : null,
        streak: Math.max(0, Math.min(10, int(m.streak) ?? 0)),
        resolvedOn: isISODate(m.resolvedOn) ? m.resolvedOn : null,
        questionId: id(m.questionId),
        history: arr(m.history).flatMap((h) => (isISODate(h.day) ? [{ day: h.day, ok: Boolean(h.ok) }] : [])),
      },
    ];
  });

  const questions: AiQuestion[] = arr(d.questions).flatMap((q) => {
    const qid = id(q.id);
    if (!qid || !isModuleId(q.moduleId) || !isObj(q.options) || !LETTERS.includes(String(q.answer))) return [];
    const diff = int(q.difficulty);
    return [
      {
        id: qid,
        batchId: str(q.batchId, 64),
        moduleId: q.moduleId,
        difficulty: (diff === 1 || diff === 2 || diff === 3 ? diff : 2) as AiQuestion["difficulty"],
        origin: (["request", "mistake", "weak", "starter"].includes(String(q.origin)) ? q.origin : "weak") as AiQuestion["origin"],
        ref: typeof q.ref === "string" ? q.ref.slice(0, 64) : null,
        stem: str(q.stem, 2000),
        options: { A: str(q.options.A, 300), B: str(q.options.B, 300), C: str(q.options.C, 300) },
        answer: q.answer as AiQuestion["answer"],
        explanation: str(q.explanation, 900),
        verification: q.verification === "python" ? "python" : "blind",
        createdAt: str(q.createdAt, 40),
      },
    ];
  });
  const qids = new Set(questions.map((q) => q.id));

  const answers: QuestionAnswer[] = arr(d.answers).flatMap((a) => {
    const aid = id(a.id);
    const qid = id(a.questionId);
    if (!aid || !qid || !qids.has(qid) || !isISODate(a.day) || !LETTERS.includes(String(a.pick))) return [];
    const q = questions.find((x) => x.id === qid)!;
    return [
      {
        id: aid,
        questionId: qid,
        day: a.day,
        pick: a.pick as QuestionAnswer["pick"],
        correct: q.answer === a.pick,
        certainty: ["sure", "unsure", "guess"].includes(String(a.certainty)) ? (a.certainty as QuestionAnswer["certainty"]) : null,
      },
    ];
  });

  const batches: AiBatch[] = arr(d.batches).flatMap((b) => {
    const bid = str(b.id, 64);
    if (!bid) return [];
    return [
      {
        id: bid,
        createdAt: str(b.createdAt, 40),
        summary: str(b.summary, 1500),
        patterns: Array.isArray(b.patterns) ? (b.patterns as AiBatch["patterns"]) : [],
        meta: isObj(b.meta) ? (b.meta as AiBatch["meta"]) : {},
      },
    ];
  });

  const requests: QuestionRequest[] = arr(d.requests).flatMap((r) => {
    const rid = id(r.id);
    const count = int(r.count);
    const diff = int(r.difficulty);
    if (!rid || !isISODate(r.createdOn) || count == null || count < 3 || count > 20) return [];
    const mod = isModuleId(r.moduleId) ? r.moduleId : null;
    const topic = isTopicId(r.topicId) ? r.topicId : null;
    if (mod == null && topic == null) return [];
    return [
      {
        id: rid,
        createdOn: r.createdOn,
        topicId: mod ? null : topic,
        moduleId: mod,
        difficulty: (diff === 1 || diff === 2 || diff === 3 ? diff : 2) as QuestionRequest["difficulty"],
        count,
        note: str(r.note, 240),
        servedBatchId: typeof r.servedBatchId === "string" ? r.servedBatchId : null,
      },
    ];
  });

  const reports: QuestionReport[] = arr(d.reports).flatMap((r) => {
    const rid = id(r.id);
    const qid = id(r.questionId);
    if (!rid || !qid || !qids.has(qid) || !isISODate(r.day)) return [];
    return [{ id: rid, questionId: qid, day: r.day, reason: str(r.reason, 300) }];
  });

  return {
    profile: normalizeProfile(isObj(d.profile) ? (d.profile as Partial<Dataset["profile"]>) : null, today),
    progress,
    sessions,
    attempts,
    mistakes,
    batches,
    questions,
    answers,
    requests,
    reports,
  };
}
