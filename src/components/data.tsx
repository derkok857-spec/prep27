"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { todayIn, isISODate, type ISODate } from "@/lib/dates";
import { normalizeProfile, progressOf } from "@/lib/defaults";
import { weakModules, type WeakModule } from "@/lib/focus";
import { newId } from "@/lib/format";
import { detectInsights, type Insight } from "@/lib/insights";
import { answersByQuestion, reportedIds, waitingQuestions } from "@/lib/lab";
import {
  allTopicStats,
  masteryMap,
  practiceEvents,
  readiness,
  type ModuleMastery,
  type PracticeEvent,
  type TopicStats,
} from "@/lib/mastery";
import { buildPlan, type Plan } from "@/lib/planner";
import { LocalRepo } from "@/lib/repo/local";
import type { Repo, RepoMode } from "@/lib/repo/types";
import {
  dueMistakes,
  dueReviews,
  firstReview,
  recheckMistake,
  reopenMistake,
  resolveMistake,
  type DueReview,
  type ReviewKey,
} from "@/lib/srs";
import { timeEntries, type TimeEntry } from "@/lib/timelog";
import type {
  AiQuestion,
  Certainty,
  Confidence,
  Dataset,
  Letter,
  Mistake,
  ModuleProgress,
  PracticeAttempt,
  Profile,
  QuestionAnswer,
  QuestionRequest,
  Status,
  StudySession,
} from "@/lib/types";
import { useToast } from "./toast";

export const TODAY_OVERRIDE_KEY = "prep27-today";

export interface Derived {
  events: PracticeEvent[];
  entries: TimeEntry[];
  mm: Map<number, ModuleMastery>;
  topicStats: TopicStats[];
  readiness: number;
  plan: Plan;
  insights: Insight[];
  dueReviews: DueReview[];
  dueMistakes: Mistake[];
  waiting: AiQuestion[];
  answersByQ: Map<string, QuestionAnswer[]>;
  reported: Set<string>;
  weak: WeakModule[];
}

export interface Actions {
  saveProfile(patch: Partial<Profile>): Promise<void>;
  setStatus(moduleId: number, status: Status): Promise<void>;
  setConfidence(moduleId: number, c: Confidence | null): Promise<void>;
  setNotes(moduleId: number, notes: string): Promise<void>;
  setHoursOverride(moduleId: number, hours: number | null): Promise<void>;
  markReview(moduleId: number, key: ReviewKey): Promise<void>;
  logSession(s: Omit<StudySession, "id">): Promise<void>;
  deleteSession(id: string): Promise<void>;
  logAttempt(a: Omit<PracticeAttempt, "id">): Promise<void>;
  deleteAttempt(id: string): Promise<void>;
  addMistake(
    m: Pick<Mistake, "moduleId" | "description" | "lesson" | "errorType" | "certainty" | "source"> & {
      createdOn?: ISODate;
      questionId?: string | null;
    },
  ): Promise<void>;
  updateMistake(
    id: string,
    patch: Partial<Pick<Mistake, "description" | "lesson" | "errorType" | "certainty" | "moduleId">>,
  ): Promise<void>;
  recheckMistake(id: string, ok: boolean): Promise<void>;
  resolveMistake(id: string): Promise<void>;
  reopenMistake(id: string): Promise<void>;
  deleteMistake(id: string): Promise<void>;
  answerQuestion(questionId: string, pick: Letter, certainty: Certainty | null): Promise<QuestionAnswer | null>;
  addRequest(r: Omit<QuestionRequest, "id" | "createdOn" | "servedBatchId">): Promise<void>;
  deleteRequest(id: string): Promise<void>;
  reportQuestion(questionId: string, reason: string): Promise<void>;
  importData(ds: Dataset): Promise<void>;
  resetDemo(): Promise<void>;
}

interface Ctx {
  ds: Dataset;
  today: ISODate;
  mode: RepoMode;
  derived: Derived;
  actions: Actions;
  reload(): Promise<void>;
}

const DataCtx = createContext<Ctx | null>(null);

export function useData(): Ctx {
  const v = useContext(DataCtx);
  if (!v) throw new Error("useData must be used inside DataProvider");
  return v;
}

function resolveToday(mode: RepoMode): ISODate {
  if (mode === "demo") {
    try {
      const o = window.localStorage.getItem(TODAY_OVERRIDE_KEY);
      if (o && isISODate(o)) return o;
    } catch {
      // ignore
    }
  }
  return todayIn();
}

export function computeDerived(ds: Dataset, today: ISODate): Derived {
  const events = practiceEvents(ds);
  const entries = timeEntries(ds);
  const mm = masteryMap(ds, today, events);
  const topicStats = allTopicStats(mm, ds);
  const plan = buildPlan(ds, today, entries);
  return {
    events,
    entries,
    mm,
    topicStats,
    readiness: readiness(topicStats),
    plan,
    insights: detectInsights(ds, today, { plan, mm, events, entries }),
    dueReviews: dueReviews(ds, today),
    dueMistakes: dueMistakes(ds.mistakes, today),
    waiting: waitingQuestions(ds),
    answersByQ: answersByQuestion(ds.answers),
    reported: reportedIds(ds),
    weak: weakModules(ds, today, mm, 6),
  };
}

export function DataProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  const toast = useToast();
  const [today, setToday] = useState<ISODate>(() => resolveToday(repo.mode));
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Source of truth for mutations, updated synchronously so back to back actions never read stale data.
  const dsRef = useRef<Dataset | null>(null);
  const put = useCallback((next: Dataset) => {
    dsRef.current = next;
    setDs(next);
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const t = resolveToday(repo.mode);
      setToday(t);
      put(await repo.load(t));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [repo, put]);

  useEffect(() => {
    let alive = true;
    repo.load(resolveToday(repo.mode)).then(
      (loaded) => {
        if (alive) put(loaded);
      },
      (e: Error) => {
        if (alive) setError(e.message);
      },
    );
    return () => {
      alive = false;
    };
  }, [repo, put]);

  // Roll over to a new day when the tab comes back after midnight.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const t = resolveToday(repo.mode);
      setToday((prev) => (prev === t ? prev : t));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [repo.mode]);

  const commit = useCallback(
    async (apply: (d: Dataset) => Dataset, persist: () => Promise<void>, ok?: string) => {
      const cur = dsRef.current;
      if (!cur) return;
      put(apply(cur));
      try {
        await persist();
        if (ok) toast(ok, "good");
      } catch (e) {
        toast(`${(e as Error).message}. Reloading your data.`, "bad");
        await reload();
      }
    },
    [put, reload, toast],
  );

  const current = useCallback((): Dataset => {
    if (!dsRef.current) throw new Error("Data not loaded");
    return dsRef.current;
  }, []);

  const actions = useMemo<Actions>(() => {
    const saveProgress = (next: ModuleProgress, ok?: string) =>
      commit(
        (d) => ({ ...d, progress: { ...d.progress, [next.moduleId]: next } }),
        () => repo.saveProgress(next),
        ok,
      );
    const patchProgress = (moduleId: number, patch: Partial<ModuleProgress>, ok?: string) =>
      saveProgress({ ...progressOf(current(), moduleId), ...patch }, ok);
    const saveMistake = (next: Mistake, ok?: string) =>
      commit(
        (d) => ({ ...d, mistakes: d.mistakes.map((m) => (m.id === next.id ? next : m)) }),
        () => repo.saveMistake(next),
        ok,
      );
    const findMistake = (id: string) => {
      const m = current().mistakes.find((x) => x.id === id);
      if (!m) throw new Error("Mistake not found");
      return m;
    };

    return {
      async saveProfile(patch) {
        const next = normalizeProfile({ ...current().profile, ...patch }, today);
        await commit(
          (d) => ({ ...d, profile: next }),
          () => repo.saveProfile(next),
          "Settings saved",
        );
      },
      async setStatus(moduleId, status) {
        const p = progressOf(current(), moduleId);
        if (p.status === status) return;
        if (status === "done") await patchProgress(moduleId, { status, doneAt: today, reviews: {} }, "Marked done. First review tomorrow.");
        else await patchProgress(moduleId, { status, doneAt: null, reviews: {} });
      },
      async setConfidence(moduleId, c) {
        await patchProgress(moduleId, { confidence: c });
      },
      async setNotes(moduleId, notes) {
        await patchProgress(moduleId, { notes: notes.slice(0, 4000) });
      },
      async setHoursOverride(moduleId, hours) {
        await patchProgress(moduleId, { hoursOverride: hours == null ? null : Math.max(0, Math.min(100, hours)) });
      },
      async markReview(moduleId, key) {
        const p = progressOf(current(), moduleId);
        await patchProgress(moduleId, { reviews: { ...p.reviews, [key]: today } }, "Review logged");
      },
      async logSession(input) {
        const s: StudySession = { ...input, id: newId() };
        await commit(
          (d) => ({ ...d, sessions: [...d.sessions, s] }),
          () => repo.addSession(s),
          `Logged ${Math.round(s.minutes)} min`,
        );
        if (s.moduleId != null && progressOf(current(), s.moduleId).status === "todo") {
          await patchProgress(s.moduleId, { status: "reading" });
        }
      },
      async deleteSession(id) {
        await commit(
          (d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }),
          () => repo.deleteSession(id),
        );
      },
      async logAttempt(input) {
        const a: PracticeAttempt = { ...input, id: newId() };
        const p = a.questions > 0 ? Math.round((a.correct / a.questions) * 100) : 0;
        await commit(
          (d) => ({ ...d, attempts: [...d.attempts, a] }),
          () => repo.addAttempt(a),
          `Logged ${a.correct}/${a.questions}, ${p}%`,
        );
      },
      async deleteAttempt(id) {
        await commit(
          (d) => ({ ...d, attempts: d.attempts.filter((a) => a.id !== id) }),
          () => repo.deleteAttempt(id),
        );
      },
      async addMistake(input) {
        const createdOn = input.createdOn ?? today;
        const m: Mistake = {
          id: newId(),
          moduleId: input.moduleId,
          createdOn,
          description: input.description.trim().slice(0, 1000),
          lesson: input.lesson.trim().slice(0, 1000),
          errorType: input.errorType,
          certainty: input.certainty,
          source: input.source,
          nextReview: firstReview(createdOn),
          streak: 0,
          resolvedOn: null,
          questionId: input.questionId ?? null,
          history: [],
        };
        await commit(
          (d) => ({ ...d, mistakes: [...d.mistakes, m] }),
          () => repo.saveMistake(m),
          "Saved. First re-check in 3 days.",
        );
      },
      async updateMistake(id, patch) {
        await saveMistake({ ...findMistake(id), ...patch }, "Mistake updated");
      },
      async recheckMistake(id, ok) {
        const m = findMistake(id);
        const next = { ...m, ...recheckMistake(m, ok, today) };
        const msg = !ok
          ? "Back in 3 days"
          : next.resolvedOn
            ? "Resolved after three clean checks"
            : `Clean check. Next one ${next.nextReview}`;
        await saveMistake(next, msg);
      },
      async resolveMistake(id) {
        const m = findMistake(id);
        await saveMistake({ ...m, ...resolveMistake(m, today) }, "Marked resolved");
      },
      async reopenMistake(id) {
        const m = findMistake(id);
        await saveMistake({ ...m, ...reopenMistake(m, today) }, "Reopened");
      },
      async deleteMistake(id) {
        await commit(
          (d) => ({ ...d, mistakes: d.mistakes.filter((m) => m.id !== id) }),
          () => repo.deleteMistake(id),
        );
      },
      async answerQuestion(questionId, pick, certainty) {
        const q = current().questions.find((x) => x.id === questionId);
        if (!q) return null;
        const a: QuestionAnswer = { id: newId(), questionId, day: today, pick, correct: pick === q.answer, certainty };
        await commit(
          (d) => ({ ...d, answers: [...d.answers, a] }),
          () => repo.addAnswer(a),
        );
        return a;
      },
      async addRequest(input) {
        const r: QuestionRequest = { ...input, id: newId(), createdOn: today, servedBatchId: null };
        await commit(
          (d) => ({ ...d, requests: [...d.requests, r] }),
          () => repo.addRequest(r),
          "Queued for the next AI run",
        );
      },
      async deleteRequest(id) {
        await commit(
          (d) => ({ ...d, requests: d.requests.filter((r) => r.id !== id) }),
          () => repo.deleteRequest(id),
        );
      },
      async reportQuestion(questionId, reason) {
        const r = { id: newId(), questionId, day: today, reason: reason.slice(0, 300) };
        await commit(
          (d) => ({ ...d, reports: [...d.reports, r] }),
          () => repo.addReport(r),
          "Reported. The next run takes it into account.",
        );
      },
      async importData(next) {
        try {
          await repo.importData(next);
          toast("Backup imported", "good");
        } catch (e) {
          toast((e as Error).message, "bad");
        }
        await reload();
      },
      async resetDemo() {
        if (repo instanceof LocalRepo) {
          put(await repo.reset(today));
          toast("Demo data reset", "good");
        }
      },
    };
  }, [commit, current, put, repo, reload, today, toast]);

  const derived = useMemo(() => (ds ? computeDerived(ds, today) : null), [ds, today]);

  if (error) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-bad/30 bg-bad-soft p-5 text-sm text-bad">
        <p className="font-semibold">Could not load your data</p>
        <p className="mt-1 break-words">{error}</p>
        <button type="button" onClick={() => void reload()} className="mt-3 rounded-lg border border-bad/40 px-3 py-1.5 font-medium">
          Try again
        </button>
      </div>
    );
  }
  if (!ds || !derived) {
    return (
      <div className="mx-auto mt-16 flex max-w-md flex-col gap-3" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-sunken" />
        ))}
      </div>
    );
  }
  return <DataCtx.Provider value={{ ds, today, mode: repo.mode, derived, actions, reload }}>{children}</DataCtx.Provider>;
}
