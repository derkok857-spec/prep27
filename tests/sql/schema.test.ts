// Runs supabase/schema.sql in an in-process Postgres (PGlite) with a stub of Supabase's auth schema,
// then checks seeds, constraints, row level security and the worker function.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODULES, TOPICS } from "@/lib/curriculum";
import { withSeed } from "@/lib/seed-sql";

const schemaPath = fileURLToPath(new URL("../../supabase/schema.sql", import.meta.url));
const schema = readFileSync(schemaPath, "utf8");

const AUTH_STUB = `
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
`;

// What Supabase grants out of the box. Row level security is what actually protects the data.
const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

let db: PGlite;

async function as<T>(role: "anon" | "authenticated" | "service_role", user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

const count = async (sql: string, params: unknown[] = []) =>
  Number(((await db.query<{ n: number }>(sql, params)).rows[0] as { n: number }).n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(schema);
  await db.exec(GRANTS);
  await db.query(`insert into auth.users (id) values ($1), ($2)`, [U1, U2]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("seed", () => {
  it("stays in sync with src/lib/curriculum.ts", () => {
    expect(withSeed(schema)).toBe(schema);
  });

  it("loads the 10 topics and 102 modules", async () => {
    expect(await count("select count(*)::int as n from public.topics")).toBe(TOPICS.length);
    const rows = (
      await db.query<{ id: number; title: string; topic_id: string }>("select id, title, topic_id from public.modules order by id")
    ).rows;
    expect(rows).toHaveLength(102);
    expect(rows.map((r) => r.title)).toEqual(MODULES.map((m) => m.title));
    expect(rows.map((r) => r.topic_id)).toEqual(MODULES.map((m) => m.topic));
  });
});

describe("row level security", () => {
  it("fills user_id from the session and keeps users apart", async () => {
    await as("authenticated", U1, async () => {
      await db.query(`insert into public.profiles (weekly_hours) values (14)`);
      await db.query(`insert into public.study_sessions (day, minutes, module_id) values ('2026-10-05', 90, 4)`);
      await db.query(`insert into public.module_progress (module_id, status) values (4, 'done')`);
    });
    expect(await count("select count(*)::int as n from public.study_sessions where user_id = $1", [U1])).toBe(1);

    await as("authenticated", U2, async () => {
      expect(await count("select count(*)::int as n from public.study_sessions")).toBe(0);
      expect(await count("select count(*)::int as n from public.profiles")).toBe(0);
      const upd = await db.query(`update public.study_sessions set minutes = 1`);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query(`delete from public.module_progress`);
      expect(del.affectedRows).toBe(0);
      await expect(
        db.query(`insert into public.study_sessions (user_id, day, minutes) values ($1, '2026-10-05', 30)`, [U1]),
      ).rejects.toThrow(/row-level security/);
    });

    await as("authenticated", U1, async () => {
      expect(await count("select count(*)::int as n from public.study_sessions")).toBe(1);
      const p = await db.query<{ weekly_hours: string }>(`select weekly_hours from public.profiles`);
      expect(Number(p.rows[0].weekly_hours)).toBe(14);
    });
  });

  it("hides everything from anonymous visitors", async () => {
    await as("anon", null, async () => {
      expect(await count("select count(*)::int as n from public.topics")).toBe(0);
      expect(await count("select count(*)::int as n from public.study_sessions")).toBe(0);
    });
  });

  it("lets users read but never write the AI tables", async () => {
    await as("authenticated", U1, async () => {
      await expect(db.query(`insert into public.ai_batches (user_id, run_key) values ($1, 'x')`, [U1])).rejects.toThrow(
        /row-level security/,
      );
      await expect(db.query(`select public.worker_insert_batch($1, '{}'::jsonb)`, [U1])).rejects.toThrow(/permission denied/);
    });
  });
});

describe("constraints", () => {
  it("rejects impossible practice blocks and unknown values", async () => {
    await as("authenticated", U1, async () => {
      await expect(
        db.query(`insert into public.practice_attempts (day, module_id, questions, correct) values ('2026-10-05', 4, 10, 11)`),
      ).rejects.toThrow(/check/);
      await expect(db.query(`insert into public.study_sessions (day, minutes) values ('2026-10-05', 0)`)).rejects.toThrow(/check/);
      await expect(db.query(`insert into public.module_progress (module_id, status) values (5, 'skimmed')`)).rejects.toThrow(/check/);
      await expect(db.query(`insert into public.module_progress (module_id, status) values (999, 'done')`)).rejects.toThrow(/foreign key/);
      await expect(
        db.query(`insert into public.question_requests (created_on, difficulty, count) values ('2026-10-05', 2, 8)`),
      ).rejects.toThrow(/check/);
    });
  });
});

describe("worker batch", () => {
  let batchId = "";
  let requestId = "";
  let questionId = "";

  it("inserts a batch, its questions and marks requests served in one call", async () => {
    await as("authenticated", U1, async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.question_requests (created_on, module_id, difficulty, count) values ('2026-10-04', 4, 2, 5) returning id`,
      );
      requestId = r.rows[0].id;
    });
    const payload = {
      runKey: "2026-10-04",
      summary: "Coach note",
      patterns: [{ title: "t", detail: "d", evidence: [], modules: [4], action: "a" }],
      meta: { discarded: 1 },
      servedRequestIds: [requestId],
      questions: [1, 2].map((i) => ({
        moduleId: 4,
        difficulty: 2,
        origin: "request",
        ref: requestId,
        stem: `Question number ${i} about compounding is closest to`,
        options: { A: "1", B: "2", C: "3" },
        answer: "B",
        explanation: "because",
        verification: "python",
      })),
    };
    const res = await as("service_role", null, () =>
      db.query<{ r: { batchId: string; inserted: number; duplicate: boolean } }>(`select public.worker_insert_batch($1, $2::jsonb) as r`, [
        U1,
        JSON.stringify(payload),
      ]),
    );
    expect(res.rows[0].r).toMatchObject({ inserted: 2, duplicate: false });
    batchId = res.rows[0].r.batchId;

    const again = await as("service_role", null, () =>
      db.query<{ r: { batchId: string; inserted: number; duplicate: boolean } }>(`select public.worker_insert_batch($1, $2::jsonb) as r`, [
        U1,
        JSON.stringify(payload),
      ]),
    );
    expect(again.rows[0].r).toEqual({ batchId, inserted: 0, duplicate: true });
    expect(await count("select count(*)::int as n from public.ai_questions where batch_id = $1", [batchId])).toBe(2);

    await as("authenticated", U1, async () => {
      const req = await db.query<{ served_batch_id: string }>(`select served_batch_id from public.question_requests where id = $1`, [
        requestId,
      ]);
      expect(req.rows[0].served_batch_id).toBe(batchId);
      const qs = await db.query<{ id: string }>(`select id from public.ai_questions order by stem`);
      expect(qs.rows).toHaveLength(2);
      questionId = qs.rows[0].id;
    });
    await as("authenticated", U2, async () => {
      expect(await count("select count(*)::int as n from public.ai_questions")).toBe(0);
    });
  });

  it("grades Lab answers on the server", async () => {
    await as("authenticated", U1, async () => {
      const r = await db.query<{ correct: boolean }>(
        `insert into public.question_answers (question_id, day, pick, correct) values ($1, '2026-10-05', 'B', false) returning correct`,
        [questionId],
      );
      expect(r.rows[0].correct).toBe(true);
      const w = await db.query<{ correct: boolean }>(
        `insert into public.question_answers (question_id, day, pick, correct) values ($1, '2026-10-05', 'A', true) returning correct`,
        [questionId],
      );
      expect(w.rows[0].correct).toBe(false);
    });
  });

  it("stops users from pointing at someone else's question", async () => {
    await as("authenticated", U2, async () => {
      await expect(
        db.query(`insert into public.question_answers (question_id, day, pick, correct) values ($1, '2026-10-05', 'B', true)`, [
          questionId,
        ]),
      ).rejects.toThrow();
      await expect(
        db.query(
          `insert into public.mistakes (module_id, created_on, description, error_type, question_id) values (4, '2026-10-05', 'x', 'calc', $1)`,
          [questionId],
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        db.query(`insert into public.question_reports (question_id, day, reason) values ($1, '2026-10-05', 'x')`, [questionId]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("cascades a deleted batch to its questions and answers", async () => {
    await db.query(`delete from public.ai_batches where id = $1`, [batchId]);
    expect(await count("select count(*)::int as n from public.ai_questions")).toBe(0);
    expect(await count("select count(*)::int as n from public.question_answers")).toBe(0);
  });
});

describe("views", () => {
  it("report weekly hours per user under row level security", async () => {
    await as("authenticated", U2, async () => {
      await db.query(`insert into public.study_sessions (day, minutes) values ('2026-10-06', 120)`);
      const rows = (await db.query<{ week_start: string; hours: string }>(`select week_start::text, hours from public.weekly_hours`)).rows;
      expect(rows).toEqual([{ week_start: "2026-10-05", hours: "2.00" }]);
    });
  });
});
