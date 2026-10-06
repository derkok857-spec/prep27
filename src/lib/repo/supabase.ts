import type { SupabaseClient } from "@supabase/supabase-js";
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
import { TABLE_SELECTS, datasetFromRows } from "./assemble";
import { answerToRow, attemptToRow, mistakeToRow, profileToRow, progressToRow, reportToRow, requestToRow, sessionToRow } from "./rows";
import type { Repo, TableRows } from "./types";

type Result = { error: { message: string } | null };

function check(res: Result, what: string) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
}

/** Browser repository. Every call runs as the signed in user, so row level security scopes it. */
export class SupabaseRepo implements Repo {
  readonly mode = "cloud" as const;

  constructor(private readonly sb: SupabaseClient) {}

  async load(today: ISODate): Promise<Dataset> {
    const { data: auth } = await this.sb.auth.getUser();
    if (!auth.user) throw new Error("Not signed in");

    const [profile, progress, sessions, attempts, mistakes, batches, questions, answers, requests, reports] = await Promise.all([
      this.sb.from("profiles").select("*").maybeSingle(),
      this.sb.from("module_progress").select(TABLE_SELECTS.progress),
      this.sb.from("study_sessions").select(TABLE_SELECTS.sessions).order("day"),
      this.sb.from("practice_attempts").select(TABLE_SELECTS.attempts).order("day"),
      this.sb.from("mistakes").select(TABLE_SELECTS.mistakes).order("created_on"),
      this.sb.from("ai_batches").select(TABLE_SELECTS.batches).order("created_at"),
      this.sb.from("ai_questions").select(TABLE_SELECTS.questions).order("created_at"),
      this.sb.from("question_answers").select(TABLE_SELECTS.answers).order("created_at"),
      this.sb.from("question_requests").select(TABLE_SELECTS.requests).order("created_on"),
      this.sb.from("question_reports").select(TABLE_SELECTS.reports),
    ]);
    for (const [r, name] of [
      [profile, "profile"],
      [progress, "progress"],
      [sessions, "sessions"],
      [attempts, "practice"],
      [mistakes, "mistakes"],
      [batches, "AI batches"],
      [questions, "AI questions"],
      [answers, "answers"],
      [requests, "requests"],
      [reports, "reports"],
    ] as const) {
      check(r, `Loading ${name}`);
    }

    let profileRow = profile.data as Record<string, unknown> | null;
    if (!profileRow) {
      // First sign in: create the profile with the database defaults, start date today.
      const ins = await this.sb.from("profiles").insert({ start_date: today }).select("*").single();
      check(ins, "Creating profile");
      profileRow = ins.data as Record<string, unknown>;
    }

    const rows: TableRows = {
      profile: profileRow,
      progress: (progress.data ?? []) as Record<string, unknown>[],
      sessions: (sessions.data ?? []) as Record<string, unknown>[],
      attempts: (attempts.data ?? []) as Record<string, unknown>[],
      mistakes: (mistakes.data ?? []) as Record<string, unknown>[],
      batches: (batches.data ?? []) as Record<string, unknown>[],
      questions: (questions.data ?? []) as Record<string, unknown>[],
      answers: (answers.data ?? []) as Record<string, unknown>[],
      requests: (requests.data ?? []) as Record<string, unknown>[],
      reports: (reports.data ?? []) as Record<string, unknown>[],
    };
    return datasetFromRows(rows, today);
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("Not signed in");
    return id;
  }

  async saveProfile(p: Profile) {
    const user_id = await this.uid();
    check(await this.sb.from("profiles").upsert({ user_id, ...profileToRow(p) }), "Saving settings");
  }

  async saveProgress(p: ModuleProgress) {
    const user_id = await this.uid();
    check(
      await this.sb.from("module_progress").upsert({ user_id, ...progressToRow(p) }, { onConflict: "user_id,module_id" }),
      "Saving module",
    );
  }

  async addSession(s: StudySession) {
    check(await this.sb.from("study_sessions").insert(sessionToRow(s)), "Logging time");
  }

  async deleteSession(id: string) {
    check(await this.sb.from("study_sessions").delete().eq("id", id), "Deleting session");
  }

  async addAttempt(a: PracticeAttempt) {
    check(await this.sb.from("practice_attempts").insert(attemptToRow(a)), "Logging practice");
  }

  async deleteAttempt(id: string) {
    check(await this.sb.from("practice_attempts").delete().eq("id", id), "Deleting practice");
  }

  async saveMistake(m: Mistake) {
    check(await this.sb.from("mistakes").upsert(mistakeToRow(m)), "Saving mistake");
  }

  async deleteMistake(id: string) {
    check(await this.sb.from("mistakes").delete().eq("id", id), "Deleting mistake");
  }

  async addAnswer(a: QuestionAnswer) {
    check(await this.sb.from("question_answers").insert(answerToRow(a)), "Saving answer");
  }

  async addRequest(r: QuestionRequest) {
    check(await this.sb.from("question_requests").insert(requestToRow(r)), "Queuing request");
  }

  async deleteRequest(id: string) {
    check(await this.sb.from("question_requests").delete().eq("id", id), "Deleting request");
  }

  async addReport(r: QuestionReport) {
    check(await this.sb.from("question_reports").insert(reportToRow(r)), "Reporting question");
  }

  async importData(ds: Dataset) {
    const user_id = await this.uid();
    const knownQuestions = new Set(((await this.sb.from("ai_questions").select("id")).data ?? []).map((r: { id: string }) => r.id));
    const up = async (table: string, rows: Record<string, unknown>[], onConflict?: string) => {
      if (!rows.length) return;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r) => ({ user_id, ...r }));
        check(await this.sb.from(table).upsert(chunk, onConflict ? { onConflict } : undefined), `Importing ${table}`);
      }
    };
    await this.saveProfile(ds.profile);
    await up("module_progress", Object.values(ds.progress).map(progressToRow), "user_id,module_id");
    await up("study_sessions", ds.sessions.map(sessionToRow));
    await up("practice_attempts", ds.attempts.map(attemptToRow));
    await up(
      "mistakes",
      ds.mistakes.map((m) => mistakeToRow({ ...m, questionId: m.questionId && knownQuestions.has(m.questionId) ? m.questionId : null })),
    );
    await up("question_requests", ds.requests.map(requestToRow));
    await up("question_answers", ds.answers.filter((a) => knownQuestions.has(a.questionId)).map(answerToRow));
    await up("question_reports", ds.reports.filter((r) => knownQuestions.has(r.questionId)).map(reportToRow));
  }
}
