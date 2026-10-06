import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "@/lib/repo/demo";
import type { Dataset } from "@/lib/types";
import { handleBatch, handleSnapshot, type WorkerDeps } from "@/lib/worker/handlers";
import type { BatchPayload } from "@/lib/worker/schema";
import type { InsertResult, WorkerStore } from "@/lib/worker/store";

const TOKEN = "t".repeat(40);
const NOW = new Date("2026-10-05T15:00:00Z");

function memStore(ds: Dataset, owner: string | null = "user-1") {
  const runs = new Map<string, InsertResult>();
  const inserted: BatchPayload[] = [];
  const store: WorkerStore = {
    async resolveOwner() {
      return owner;
    },
    async loadDataset() {
      return ds;
    },
    async insertBatch(_user, b) {
      const prev = runs.get(b.runKey);
      if (prev) return { ...prev, inserted: 0, duplicate: true };
      const r = { batchId: `b-${b.runKey}`, inserted: b.questions.length, duplicate: false };
      runs.set(b.runKey, r);
      inserted.push(b);
      return r;
    },
  };
  return { store, inserted };
}

const deps = (store: WorkerStore | null, token: string | null = TOKEN): WorkerDeps => ({
  store,
  token: token ?? undefined,
  timeZone: "America/Lima",
  now: NOW,
});

const get = (token?: string) => new Request("http://x/api/worker/snapshot", { headers: token ? { "x-worker-token": token } : {} });
const post = (body: unknown, token = TOKEN) =>
  new Request("http://x/api/worker/batch", {
    method: "POST",
    headers: { "x-worker-token": token, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const question = (over: Record<string, unknown> = {}) => ({
  moduleId: 19,
  difficulty: 2,
  origin: "mistake",
  ref: null,
  stem: "The GBP/USD spot rate is 0.8000 and the JPY/USD rate is 150.00. The JPY/GBP cross rate is closest to",
  options: { A: "120.00", B: "187.50", C: "0.0053" },
  answer: "B",
  explanation: "JPY/GBP = JPY/USD divided by GBP/USD = 150 / 0.8 = 187.50. A multiplies and C is the inverse quote.",
  verification: "python",
  ...over,
});

describe("worker auth", () => {
  const { store } = memStore(buildDemoDataset("2026-10-05"));

  it("refuses to run without a long enough token on the server", async () => {
    expect((await handleSnapshot(get(TOKEN), deps(store, null))).status).toBe(503);
    expect((await handleSnapshot(get("short"), deps(store, "short"))).status).toBe(503);
  });

  it("rejects missing or wrong tokens", async () => {
    expect((await handleSnapshot(get(), deps(store))).status).toBe(401);
    expect((await handleSnapshot(get("x".repeat(40)), deps(store))).status).toBe(401);
    expect((await handleBatch(post({}, "nope"), deps(store))).status).toBe(401);
  });

  it("explains a missing service role", async () => {
    const r = await handleSnapshot(get(TOKEN), deps(null));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/service role/);
  });

  it("asks for an owner when it cannot tell whose data to read", async () => {
    const { store: s } = memStore(buildDemoDataset("2026-10-05"), null);
    expect((await handleSnapshot(get(TOKEN), deps(s))).status).toBe(409);
  });
});

describe("snapshot", () => {
  it("summarizes the log for the worker", async () => {
    const ds = buildDemoDataset("2026-10-05");
    const r = await handleSnapshot(get(TOKEN), deps(memStore(ds).store));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const s = await r.json();
    expect(s.today).toBe("2026-10-05");
    expect(s.modules).toHaveLength(102);
    expect(s.modules.find((m: { id: number }) => m.id === 19).status).toBe("done");
    expect(s.thisWeek.modules).toContain(23);
    expect(s.lab.pendingRequests).toHaveLength(1);
    expect(s.lab.waiting).toBe(9);
    expect(s.mistakes.open.length).toBeGreaterThan(5);
    expect(s.insights.map((i: { id: string }) => i.id)).toContain("confident-misses");
    expect(s.previousBatch.patterns).toHaveLength(2);
    expect(s.weakModules[0].mastery).toBeLessThan(0.65);
    expect(JSON.stringify(s).length).toBeLessThan(200_000);
  });
});

describe("batch", () => {
  it("rejects bodies that are not a valid batch", async () => {
    const { store } = memStore(buildDemoDataset("2026-10-05"));
    expect((await handleBatch(post("{not json"), deps(store))).status).toBe(400);
    const r = await handleBatch(post({ runKey: "2026-10-04", summary: "short", questions: [question({ answer: "D" })] }), deps(store));
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.issues.join(" ")).toMatch(/summary/);
    expect(body.issues.join(" ")).toMatch(/questions\.0\.answer/);
  });

  it("rejects duplicated options", async () => {
    const { store } = memStore(buildDemoDataset("2026-10-05"));
    const r = await handleBatch(
      post({
        runKey: "k1",
        summary: "A summary that is long enough to pass.",
        questions: [question({ options: { A: "1", B: "1", C: "2" } })],
      }),
      deps(store),
    );
    expect(r.status).toBe(400);
  });

  it("inserts once per run key and passes served requests through", async () => {
    const { store, inserted } = memStore(buildDemoDataset("2026-10-05"));
    const body = {
      runKey: "2026-10-11",
      summary: "Exchange rate math is still the main leak. This batch drills cross rates.",
      patterns: [{ title: "Cross rates", detail: "Three misses share one cause.", modules: [19], action: "Write quotes as fractions." }],
      questions: [question(), question({ stem: "A second cross rate question with different numbers is closest to" })],
      servedRequestIds: ["0f8fad5b-d9cb-469f-a165-70867728950e"],
      meta: { discarded: 1 },
    };
    const r1 = await handleBatch(post(body), deps(store));
    expect(r1.status).toBe(201);
    expect(await r1.json()).toMatchObject({ ok: true, inserted: 2, duplicate: false });
    expect(inserted[0].meta).toMatchObject({ discarded: 1, skipped: [], servedRequests: body.servedRequestIds });
    expect(inserted[0].patterns[0].evidence).toEqual([]);
    expect(inserted[0].questions[0].ref).toBeNull();

    const r2 = await handleBatch(post(body), deps(store));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toMatchObject({ ok: true, inserted: 0, duplicate: true });
    expect(inserted).toHaveLength(1);
  });
});

describe("example batch in worker/", () => {
  it("matches the schema the API enforces", async () => {
    const { readFileSync } = await import("node:fs");
    const { BatchInput } = await import("@/lib/worker/schema");
    const raw = JSON.parse(readFileSync(new URL("../../worker/example-batch.json", import.meta.url), "utf8"));
    const parsed = BatchInput.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
});
