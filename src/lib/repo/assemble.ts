import type { ISODate } from "../dates";
import type { Dataset } from "../types";
import {
  answerFromRow,
  attemptFromRow,
  batchFromRow,
  compact,
  mistakeFromRow,
  profileFromRow,
  progressFromRow,
  questionFromRow,
  reportFromRow,
  requestFromRow,
  sessionFromRow,
} from "./rows";
import type { TableRows } from "./types";

const byText =
  <T>(key: (x: T) => string) =>
  (a: T, b: T) =>
    key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;

export function datasetFromRows(rows: TableRows, today: ISODate): Dataset {
  const progress: Dataset["progress"] = {};
  for (const p of compact(rows.progress.map(progressFromRow))) progress[p.moduleId] = p;
  return {
    profile: profileFromRow(rows.profile, today),
    progress,
    sessions: compact(rows.sessions.map(sessionFromRow)).sort(byText((s) => s.day)),
    attempts: compact(rows.attempts.map(attemptFromRow)).sort(byText((a) => a.day)),
    mistakes: compact(rows.mistakes.map(mistakeFromRow)).sort(byText((m) => m.createdOn)),
    batches: rows.batches.map(batchFromRow).sort(byText((b) => b.createdAt)),
    questions: compact(rows.questions.map(questionFromRow)).sort(byText((q) => q.createdAt)),
    answers: compact(rows.answers.map(answerFromRow)),
    requests: compact(rows.requests.map(requestFromRow)).sort(byText((r) => r.createdOn)),
    reports: compact(rows.reports.map(reportFromRow)),
  };
}

export const TABLE_SELECTS = {
  progress: "module_id, status, confidence, done_at, reviews, notes, hours_override",
  sessions: "id, day, minutes, module_id, kind, note",
  attempts: "id, day, module_id, topic_id, questions, correct, minutes, source",
  mistakes:
    "id, module_id, created_on, description, lesson, error_type, certainty, source, next_review, streak, resolved_on, question_id, history",
  batches: "id, run_key, created_at, summary, patterns, meta",
  questions: "id, batch_id, module_id, difficulty, origin, ref, stem, options, answer, explanation, verification, created_at",
  answers: "id, question_id, day, pick, correct, certainty, created_at",
  requests: "id, created_on, topic_id, module_id, difficulty, count, note, served_batch_id",
  reports: "id, question_id, day, reason",
} as const;
