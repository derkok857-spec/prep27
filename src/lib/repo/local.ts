import { isISODate, type ISODate } from "../dates";
import { normalizeProfile } from "../defaults";
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
import { buildDemoDataset } from "./demo";
import type { Repo } from "./types";

export const DEMO_STORAGE_KEY = "prep27-demo-v1";

interface Stored {
  v: 1;
  seededOn: ISODate;
  data: Dataset;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function readStorage(): Stored | null {
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.v !== 1 || !isISODate(parsed.seededOn) || !parsed.data?.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Demo repository. Keeps the dataset in this browser only, falls back to memory when storage is blocked. */
export class LocalRepo implements Repo {
  readonly mode = "demo" as const;
  private ds: Dataset | null = null;
  private seededOn: ISODate | null = null;

  async load(today: ISODate): Promise<Dataset> {
    const stored = typeof window !== "undefined" ? readStorage() : null;
    if (stored) {
      this.ds = { ...stored.data, profile: normalizeProfile(stored.data.profile, today) };
      this.seededOn = stored.seededOn;
    } else {
      this.ds = buildDemoDataset(today);
      this.seededOn = today;
      this.persist();
    }
    return clone(this.ds);
  }

  async reset(today: ISODate): Promise<Dataset> {
    this.ds = buildDemoDataset(today);
    this.seededOn = today;
    this.persist();
    return clone(this.ds);
  }

  private persist() {
    if (!this.ds || typeof window === "undefined") return;
    try {
      const payload: Stored = { v: 1, seededOn: this.seededOn ?? this.ds.profile.startDate, data: this.ds };
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage full or blocked, keep working in memory
    }
  }

  private get data(): Dataset {
    if (!this.ds) throw new Error("Demo data not loaded");
    return this.ds;
  }

  private mutate(fn: (d: Dataset) => void) {
    fn(this.data);
    this.persist();
  }

  async saveProfile(p: Profile) {
    this.mutate((d) => {
      d.profile = clone(p);
    });
  }

  async saveProgress(p: ModuleProgress) {
    this.mutate((d) => {
      d.progress[p.moduleId] = clone(p);
    });
  }

  async addSession(s: StudySession) {
    this.mutate((d) => {
      d.sessions.push(clone(s));
    });
  }

  async deleteSession(id: string) {
    this.mutate((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== id);
    });
  }

  async addAttempt(a: PracticeAttempt) {
    this.mutate((d) => {
      d.attempts.push(clone(a));
    });
  }

  async deleteAttempt(id: string) {
    this.mutate((d) => {
      d.attempts = d.attempts.filter((a) => a.id !== id);
    });
  }

  async saveMistake(m: Mistake) {
    this.mutate((d) => {
      const i = d.mistakes.findIndex((x) => x.id === m.id);
      if (i >= 0) d.mistakes[i] = clone(m);
      else d.mistakes.push(clone(m));
    });
  }

  async deleteMistake(id: string) {
    this.mutate((d) => {
      d.mistakes = d.mistakes.filter((m) => m.id !== id);
    });
  }

  async addAnswer(a: QuestionAnswer) {
    this.mutate((d) => {
      const q = d.questions.find((x) => x.id === a.questionId);
      d.answers.push({ ...clone(a), correct: q ? q.answer === a.pick : a.correct });
    });
  }

  async addRequest(r: QuestionRequest) {
    this.mutate((d) => {
      d.requests.push(clone(r));
    });
  }

  async deleteRequest(id: string) {
    this.mutate((d) => {
      d.requests = d.requests.filter((r) => r.id !== id);
    });
  }

  async addReport(r: QuestionReport) {
    this.mutate((d) => {
      d.reports.push(clone(r));
    });
  }

  async importData(ds: Dataset) {
    this.ds = clone(ds);
    this.persist();
  }
}
