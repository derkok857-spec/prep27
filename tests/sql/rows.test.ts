// Round trips every domain object through the real schema: domain -> row mapper -> INSERT -> SELECT with the
// columns the app reads -> row mapper -> domain. Catches column names, JSON shapes and numeric types that drift.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TABLE_SELECTS, datasetFromRows } from "@/lib/repo/assemble";
import { buildDemoDataset } from "@/lib/repo/demo";
import {
  answerToRow,
  attemptToRow,
  mistakeToRow,
  profileToRow,
  progressToRow,
  reportToRow,
  requestToRow,
  sessionToRow,
} from "@/lib/repo/rows";
import type { TableRows } from "@/lib/repo/types";

const schema = readFileSync(fileURLToPath(new URL("../../supabase/schema.sql", import.meta.url)), "utf8");
const USER = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-10-05";

let db: PGlite;

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const vals = cols.map((c) => {
    const v = row[c];
    return v !== null && typeof v === "object" && !Array.isArray(v)
      ? JSON.stringify(v)
      : Array.isArray(v) && table !== "profiles"
        ? JSON.stringify(v)
        : v;
  });
  const sql = `insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
  await db.query(sql, vals);
}

async function select(table: string, cols: string, order?: string) {
  const res = await db.query<Record<string, unknown>>(
    `select ${cols} from public.${table} where user_id = $1${order ? ` order by ${order}` : ""}`,
    [USER],
  );
  // PostgREST sends dates as YYYY-MM-DD and timestamps as ISO strings
  return res.rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v instanceof Date) out[k] = k.endsWith("_at") ? v.toISOString() : v.toISOString().slice(0, 10);
      else out[k] = v;
    }
    return out;
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  `);
  await db.exec(schema);
  await db.query(`insert into auth.users (id) values ($1)`, [USER]);
  await db.exec(`set timezone = 'UTC'`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("row mapping against the schema", () => {
  it("round trips the whole demo dataset", async () => {
    const ds = buildDemoDataset(TODAY);

    await insert("profiles", { user_id: USER, ...profileToRow(ds.profile) });
    for (const p of Object.values(ds.progress)) await insert("module_progress", { user_id: USER, ...progressToRow(p) });
    for (const s of ds.sessions) await insert("study_sessions", { user_id: USER, ...sessionToRow(s) });
    for (const a of ds.attempts) await insert("practice_attempts", { user_id: USER, ...attemptToRow(a) });

    // AI tables are written by the worker function, exactly like production
    const batchIds = new Map<string, string>();
    for (const b of ds.batches) {
      const qs = ds.questions.filter((q) => q.batchId === b.id);
      const payload = {
        runKey: b.meta.runKey,
        summary: b.summary,
        patterns: b.patterns,
        meta: b.meta,
        servedRequestIds: [],
        questions: qs.map((q) => ({ ...q })),
      };
      const r = await db.query<{ r: { batchId: string } }>(`select public.worker_insert_batch($1, $2::jsonb) as r`, [
        USER,
        JSON.stringify(payload),
      ]);
      batchIds.set(b.id, r.rows[0].r.batchId);
    }
    // map demo question ids to the ids the database generated, matching on stem
    const dbQuestions = await select("ai_questions", "id, stem");
    const qid = new Map(ds.questions.map((q) => [q.id, dbQuestions.find((r) => r.stem === q.stem)!.id as string]));

    for (const m of ds.mistakes)
      await insert("mistakes", { user_id: USER, ...mistakeToRow({ ...m, questionId: m.questionId ? qid.get(m.questionId)! : null }) });
    for (const a of ds.answers)
      await insert("question_answers", { user_id: USER, ...answerToRow({ ...a, questionId: qid.get(a.questionId)! }) });
    for (const r of ds.requests) await insert("question_requests", { user_id: USER, ...requestToRow(r) });
    for (const r of ds.reports) await insert("question_reports", { user_id: USER, ...reportToRow(r) });

    const rows: TableRows = {
      profile: (await select("profiles", "*"))[0],
      progress: await select("module_progress", TABLE_SELECTS.progress),
      sessions: await select("study_sessions", TABLE_SELECTS.sessions, "day"),
      attempts: await select("practice_attempts", TABLE_SELECTS.attempts, "day"),
      mistakes: await select("mistakes", TABLE_SELECTS.mistakes, "created_on"),
      batches: await select("ai_batches", TABLE_SELECTS.batches, "created_at"),
      questions: await select("ai_questions", TABLE_SELECTS.questions, "created_at"),
      answers: await select("question_answers", TABLE_SELECTS.answers, "created_at"),
      requests: await select("question_requests", TABLE_SELECTS.requests, "created_on"),
      reports: await select("question_reports", TABLE_SELECTS.reports),
    };
    const back = datasetFromRows(rows, TODAY);

    expect(back.profile).toEqual(ds.profile);
    expect(back.progress).toEqual(ds.progress);
    expect(back.sessions).toEqual([...ds.sessions].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)));
    expect(back.attempts).toEqual(ds.attempts);
    expect(back.mistakes.map((m) => ({ ...m, questionId: null }))).toEqual(
      [...ds.mistakes]
        .sort((a, b) => (a.createdOn < b.createdOn ? -1 : a.createdOn > b.createdOn ? 1 : 0))
        .map((m) => ({ ...m, questionId: null })),
    );
    expect(back.questions).toHaveLength(ds.questions.length);
    expect(back.questions.map((q) => q.stem).sort()).toEqual(ds.questions.map((q) => q.stem).sort());
    expect(back.answers.map((a) => [a.pick, a.correct, a.certainty])).toEqual(ds.answers.map((a) => [a.pick, a.correct, a.certainty]));
    expect(back.requests.map((r) => ({ ...r, servedBatchId: null }))).toEqual(ds.requests.map((r) => ({ ...r, servedBatchId: null })));
    expect(back.batches.map((b) => b.summary)).toEqual(ds.batches.map((b) => b.summary));
    expect(back.batches[1].patterns).toHaveLength(2);
    expect([...batchIds.values()].every((id) => back.batches.some((b) => b.id === id))).toBe(true);
  });
});
