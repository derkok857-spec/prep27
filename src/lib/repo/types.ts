import type { ISODate } from "../dates";
import type {
  Dataset,
  Mistake,
  ModuleProgress,
  PracticeAttempt,
  Profile,
  QuestionAnswer,
  QuestionReport,
  QuestionRequest,
  StudySession,
} from "../types";

export type RepoMode = "cloud" | "demo";

/** Storage behind the app. The browser talks to Supabase in cloud mode and to localStorage in demo mode. */
export interface Repo {
  readonly mode: RepoMode;
  load(today: ISODate): Promise<Dataset>;
  saveProfile(p: Profile): Promise<void>;
  saveProgress(p: ModuleProgress): Promise<void>;
  addSession(s: StudySession): Promise<void>;
  deleteSession(id: string): Promise<void>;
  addAttempt(a: PracticeAttempt): Promise<void>;
  deleteAttempt(id: string): Promise<void>;
  saveMistake(m: Mistake): Promise<void>;
  deleteMistake(id: string): Promise<void>;
  addAnswer(a: QuestionAnswer): Promise<void>;
  addRequest(r: QuestionRequest): Promise<void>;
  deleteRequest(id: string): Promise<void>;
  addReport(r: QuestionReport): Promise<void>;
  /** Restores a backup. Cloud mode upserts and never touches the AI tables. */
  importData(ds: Dataset): Promise<void>;
}

export interface TableRows {
  profile: Record<string, unknown> | null;
  progress: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  attempts: Record<string, unknown>[];
  mistakes: Record<string, unknown>[];
  batches: Record<string, unknown>[];
  questions: Record<string, unknown>[];
  answers: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  reports: Record<string, unknown>[];
}
