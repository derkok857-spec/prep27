// Request handling for the worker API, kept free of Next.js and Supabase imports so it can be tested directly.

import { createHash, timingSafeEqual } from "node:crypto";
import { todayIn } from "../dates";
import { BatchInput, describeIssues, toPayload } from "./schema";
import { buildSnapshot } from "./snapshot";
import type { WorkerStore } from "./store";

export interface WorkerDeps {
  store: WorkerStore | null;
  token: string | undefined;
  timeZone: string;
  now?: Date;
}

export const MIN_TOKEN_LENGTH = 32;
export const MAX_BODY_BYTES = 1_000_000;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export type TokenCheck = "ok" | "unconfigured" | "denied";

export function checkToken(req: Request, expected: string | undefined): TokenCheck {
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return "unconfigured";
  const got = req.headers.get("x-worker-token") ?? "";
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && got.length === expected.length ? "ok" : "denied";
}

function guard(req: Request, deps: WorkerDeps): Response | null {
  const t = checkToken(req, deps.token);
  if (t === "unconfigured") return json({ error: "WORKER_TOKEN is not set on the server (32 characters or more)" }, 503);
  if (t === "denied") return json({ error: "invalid worker token" }, 401);
  if (!deps.store) return json({ error: "Supabase service role is not configured" }, 503);
  return null;
}

async function owner(deps: WorkerDeps): Promise<string | Response> {
  const id = await deps.store!.resolveOwner();
  if (!id) return json({ error: "Set OWNER_USER_ID, or keep exactly one profile in the database" }, 409);
  return id;
}

export async function handleSnapshot(req: Request, deps: WorkerDeps): Promise<Response> {
  const denied = guard(req, deps);
  if (denied) return denied;
  try {
    const user = await owner(deps);
    if (user instanceof Response) return user;
    const today = todayIn(deps.timeZone, deps.now ?? new Date());
    const ds = await deps.store!.loadDataset(user, today);
    return json(buildSnapshot(ds, today, deps.timeZone));
  } catch (e) {
    return json({ error: `snapshot failed: ${(e as Error).message}` }, 500);
  }
}

export async function handleBatch(req: Request, deps: WorkerDeps): Promise<Response> {
  const denied = guard(req, deps);
  if (denied) return denied;
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ error: "could not read body" }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) return json({ error: "body too large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "body is not valid JSON" }, 400);
  }
  const parsed = BatchInput.safeParse(body);
  if (!parsed.success) return json({ error: "invalid batch", issues: describeIssues(parsed.error) }, 400);
  try {
    const user = await owner(deps);
    if (user instanceof Response) return user;
    const res = await deps.store!.insertBatch(user, toPayload(parsed.data));
    return json({ ok: true, ...res }, res.duplicate ? 200 : 201);
  } catch (e) {
    return json({ error: `insert failed: ${(e as Error).message}` }, 500);
  }
}
