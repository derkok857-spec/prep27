import type { SupabaseClient } from "@supabase/supabase-js";
import type { ISODate } from "../dates";
import { TABLE_SELECTS, datasetFromRows } from "../repo/assemble";
import type { TableRows } from "../repo/types";
import type { Dataset } from "../types";
import type { BatchPayload } from "./schema";

export interface InsertResult {
  batchId: string;
  inserted: number;
  duplicate: boolean;
}

export interface WorkerStore {
  resolveOwner(): Promise<string | null>;
  loadDataset(userId: string, today: ISODate): Promise<Dataset>;
  insertBatch(userId: string, batch: BatchPayload): Promise<InsertResult>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Store backed by the service role client. Every query filters by the owner explicitly. */
export function supabaseStore(sb: SupabaseClient, ownerFromEnv?: string): WorkerStore {
  return {
    async resolveOwner() {
      if (ownerFromEnv && UUID_RE.test(ownerFromEnv)) return ownerFromEnv;
      const { data, error } = await sb.from("profiles").select("user_id").limit(2);
      if (error) throw new Error(error.message);
      return data && data.length === 1 ? (data[0].user_id as string) : null;
    },

    async loadDataset(userId, today) {
      const t = (table: string, cols: string) => sb.from(table).select(cols).eq("user_id", userId);
      const [profile, progress, sessions, attempts, mistakes, batches, questions, answers, requests, reports] = await Promise.all([
        sb.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        t("module_progress", TABLE_SELECTS.progress),
        t("study_sessions", TABLE_SELECTS.sessions).order("day"),
        t("practice_attempts", TABLE_SELECTS.attempts).order("day"),
        t("mistakes", TABLE_SELECTS.mistakes).order("created_on"),
        t("ai_batches", TABLE_SELECTS.batches).order("created_at"),
        t("ai_questions", TABLE_SELECTS.questions).order("created_at"),
        t("question_answers", TABLE_SELECTS.answers).order("created_at"),
        t("question_requests", TABLE_SELECTS.requests).order("created_on"),
        t("question_reports", TABLE_SELECTS.reports),
      ]);
      for (const r of [profile, progress, sessions, attempts, mistakes, batches, questions, answers, requests, reports]) {
        if (r.error) throw new Error(r.error.message);
      }
      const rows = (x: { data: unknown }) => (x.data ?? []) as Record<string, unknown>[];
      const tr: TableRows = {
        profile: (profile.data as Record<string, unknown> | null) ?? null,
        progress: rows(progress),
        sessions: rows(sessions),
        attempts: rows(attempts),
        mistakes: rows(mistakes),
        batches: rows(batches),
        questions: rows(questions),
        answers: rows(answers),
        requests: rows(requests),
        reports: rows(reports),
      };
      return datasetFromRows(tr, today);
    },

    async insertBatch(userId, batch) {
      const { data, error } = await sb.rpc("worker_insert_batch", { p_user: userId, p_batch: batch });
      if (error) throw new Error(error.message);
      const r = data as InsertResult;
      return { batchId: String(r.batchId), inserted: Number(r.inserted), duplicate: Boolean(r.duplicate) };
    },
  };
}
