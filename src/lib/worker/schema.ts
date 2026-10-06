import { z } from "zod";
import { MODULE_COUNT } from "../curriculum";

const moduleId = z.number().int().min(1).max(MODULE_COUNT);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const QuestionInput = z
  .object({
    moduleId,
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    origin: z.enum(["request", "mistake", "weak", "starter"]),
    ref: z.string().trim().max(64).nullable().optional(),
    stem: text(20, 1500),
    options: z.object({ A: text(1, 300), B: text(1, 300), C: text(1, 300) }),
    answer: z.enum(["A", "B", "C"]),
    explanation: text(10, 900),
    verification: z.enum(["python", "blind"]),
  })
  .refine((q) => new Set([q.options.A, q.options.B, q.options.C].map((s) => s.toLowerCase())).size === 3, {
    message: "options must be distinct",
    path: ["options"],
  });

export const PatternInput = z.object({
  title: text(3, 120),
  detail: text(10, 600),
  evidence: z.array(z.string().max(64)).max(20).default([]),
  modules: z.array(moduleId).max(10).default([]),
  action: text(5, 300),
});

export const BatchInput = z.object({
  runKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._:-]{1,64}$/, "runKey must be 1 to 64 letters, digits or . _ : -"),
  summary: text(20, 1500),
  patterns: z.array(PatternInput).max(5).default([]),
  questions: z.array(QuestionInput).max(40),
  servedRequestIds: z.array(z.string().uuid()).max(50).default([]),
  meta: z
    .object({
      discarded: z.number().int().min(0).max(500).default(0),
      skipped: z
        .array(z.object({ moduleId, reason: z.string().max(200) }))
        .max(102)
        .default([]),
      notes: z.string().max(500).optional(),
    })
    .default({ discarded: 0, skipped: [] }),
});

export type BatchInputT = z.infer<typeof BatchInput>;

/** What the database function receives. */
export interface BatchPayload {
  runKey: string;
  summary: string;
  patterns: BatchInputT["patterns"];
  questions: BatchInputT["questions"];
  servedRequestIds: string[];
  meta: BatchInputT["meta"] & { servedRequests: string[] };
}

export function toPayload(b: BatchInputT): BatchPayload {
  return {
    runKey: b.runKey,
    summary: b.summary,
    patterns: b.patterns,
    questions: b.questions.map((q) => ({ ...q, ref: q.ref ?? null })),
    servedRequestIds: b.servedRequestIds,
    meta: { ...b.meta, servedRequests: b.servedRequestIds },
  };
}

export function describeIssues(err: z.ZodError, limit = 12): string[] {
  return err.issues.slice(0, limit).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
