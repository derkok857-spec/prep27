import { describe, expect, it } from "vitest";
import { isModuleId } from "@/lib/curriculum";
import { addDays, isISODate } from "@/lib/dates";
import { detectInsights } from "@/lib/insights";
import { waitingQuestions } from "@/lib/lab";
import { masteryMap, practiceEvents } from "@/lib/mastery";
import { buildPlan } from "@/lib/planner";
import { buildDemoDataset } from "@/lib/repo/demo";
import { dueMistakes, dueReviews } from "@/lib/srs";
import { timeEntries } from "@/lib/timelog";

describe.each(["2026-10-05", "2026-10-08", "2026-10-11", "2027-01-20"])("demo dataset on %s", (today) => {
  const ds = buildDemoDataset(today);

  it("is deterministic", () => {
    expect(buildDemoDataset(today)).toEqual(ds);
  });

  it("never logs anything on or after today", () => {
    for (const s of ds.sessions) expect(s.day < today).toBe(true);
    for (const a of ds.attempts) expect(a.day < today).toBe(true);
    for (const m of ds.mistakes) expect(m.createdOn < today).toBe(true);
    for (const a of ds.answers) expect(a.day < today).toBe(true);
  });

  it("keeps every record valid", () => {
    for (const a of ds.attempts) {
      expect(a.correct).toBeLessThanOrEqual(a.questions);
      expect(a.moduleId == null || isModuleId(a.moduleId)).toBe(true);
    }
    for (const m of ds.mistakes) {
      expect(isModuleId(m.moduleId)).toBe(true);
      // a mistake comes after the module was studied
      const p = ds.progress[m.moduleId];
      expect(p?.status).toBe("done");
      expect(p!.doneAt! <= m.createdOn).toBe(true);
      if (m.questionId) expect(ds.questions.some((q) => q.id === m.questionId)).toBe(true);
    }
    const qids = new Set(ds.questions.map((q) => q.id));
    for (const a of ds.answers) expect(qids.has(a.questionId)).toBe(true);
    for (const q of ds.questions) expect(ds.batches.some((b) => b.id === q.batchId)).toBe(true);
    const ids = [...ds.sessions, ...ds.attempts, ...ds.mistakes, ...ds.questions, ...ds.answers].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
    for (const c of ds.profile.capacityChanges) expect(isISODate(c.from) && c.from <= c.to).toBe(true);
  });

  it("shows the problems the app is meant to catch", () => {
    const events = practiceEvents(ds);
    const entries = timeEntries(ds);
    const mm = masteryMap(ds, today, events);
    const plan = buildPlan(ds, today, entries);
    const ids = detectInsights(ds, today, { plan, mm, events, entries }).map((i) => i.id);
    expect(ids).toContain("confident-misses");
    expect(ids).toContain("type-formula");
    expect(ids).toContain("module-hotspot");
    expect(ids).toContain("stubborn");
    expect(dueMistakes(ds.mistakes, today).length).toBeGreaterThan(0);
    expect(dueReviews(ds, today).length).toBeGreaterThan(0);
    expect(waitingQuestions(ds).length).toBe(9);
  });
});

describe("demo pace", () => {
  it("logs roughly a student's week and leaves content in progress", () => {
    const today = "2026-10-05";
    const ds = buildDemoDataset(today);
    const plan = buildPlan(ds, today);
    expect(plan.measuredPace).not.toBeNull();
    expect(plan.measuredPace!).toBeGreaterThan(6);
    expect(plan.measuredPace!).toBeLessThan(12);
    expect(plan.remainingModules).toBe(102 - 22);
    expect(plan.weeks.filter((w) => w.phase === "past")).toHaveLength(7);
    expect(ds.profile.startDate).toBe(addDays("2026-10-05", -49));
  });
});
