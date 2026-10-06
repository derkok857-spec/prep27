import { describe, expect, it } from "vitest";
import { MODULES, modulesOf } from "@/lib/curriculum";
import { buildPlan, phaseDates, weeklyHoursOn } from "@/lib/planner";
import { makeDs, session, setProgress } from "./helpers";

const MON = "2026-10-05";

describe("planner", () => {
  it("places the mock phase in the five full weeks before the exam week", () => {
    const ds = makeDs(MON);
    expect(phaseDates(ds.profile)).toEqual({ examWeek: "2027-05-10", mockStart: "2027-04-05", contentEnd: "2027-04-04" });
  });

  it("fits 300 h at 12 h a week and leaves a buffer week", () => {
    const ds = makeDs(MON);
    const p = buildPlan(ds, MON);
    expect(p.remainingHours).toBeCloseTo(300, 6);
    expect(p.capacityHours).toBeCloseTo(312, 6);
    expect(p.fits).toBe(true);
    expect(p.scale).toBe(1);
    expect(p.bufferHours).toBeCloseTo(12, 6);
    expect(p.finishAtPlan).toBe("2027-03-27");
    expect(p.requiredWeekly).toBeCloseTo(300 / 26, 6);

    expect(p.weeks).toHaveLength(32);
    expect(p.weeks[0]).toMatchObject({ start: MON, phase: "content", isCurrent: true });
    expect(p.weeks.find((w) => w.start === "2027-03-29")?.phase).toBe("buffer");
    expect(p.weeks.filter((w) => w.phase === "mock").map((w) => w.mockIndex)).toEqual([1, 2, 3, 4, 5]);
    const exam = p.weeks[p.weeks.length - 1];
    expect(exam).toMatchObject({ start: "2027-05-10", phase: "exam" });
    expect(exam.capacity).toBeCloseTo(2, 6);

    // every module is scheduled exactly once in total hours
    const planned = p.weeks.reduce((a, w) => a + w.items.reduce((b, it) => b + it.hours, 0), 0);
    expect(planned).toBeCloseTo(300, 6);
    expect(p.schedule.size).toBe(MODULES.length);
  });

  it("starts today with two hours of the first module in topic order", () => {
    const p = buildPlan(makeDs(MON), MON);
    expect(p.todayPlan.isReviewDay).toBe(false);
    expect(p.todayPlan.targetHours).toBeCloseTo(2, 6);
    expect(p.todayPlan.items[0].moduleId).toBe(1);
  });

  it("scales the plan up and reports the pace needed when hours do not fit", () => {
    const ds = makeDs(MON, { weeklyHours: 10 });
    const p = buildPlan(ds, MON);
    expect(p.fits).toBe(false);
    expect(p.scale).toBeCloseTo(300 / 260, 6);
    expect(p.requiredWeekly).toBeCloseTo(300 / 26, 6);
    expect(p.finishAtPlan).toBe("2027-04-03");
    expect(p.finishAtConfigured! > p.contentEnd).toBe(true);
  });

  it("keeps Sunday for reviews", () => {
    const sun = "2026-10-11";
    const p = buildPlan(makeDs(sun, { startDate: MON }), sun);
    expect(p.todayPlan.isReviewDay).toBe(true);
    expect(p.todayPlan.targetHours).toBe(0);
    expect(p.weeks.find((w) => w.isCurrent)?.phase).toBe("content");
  });

  it("puts modules in progress first and drops finished ones", () => {
    const ds = makeDs(MON);
    for (const m of modulesOf("quant")) setProgress(ds, m.id, { status: "done", doneAt: "2026-10-01" });
    setProgress(ds, 50, { status: "reading" });
    const p = buildPlan(ds, MON);
    expect(p.remainingModules).toBe(102 - 11 - 0);
    expect(p.remainingHours).toBeCloseTo(300 - (300 * 7.5) / 102.5, 6);
    expect(p.todayPlan.items[0].moduleId).toBe(50);
  });

  it("shrinks a module by the time already logged on it, down to a floor", () => {
    const ds = makeDs(MON);
    setProgress(ds, 1, { status: "reading" });
    ds.sessions.push(session({ day: "2026-10-04", minutes: 60, moduleId: 1 }));
    const h = (300 * 7.5) / 102.5 / 11;
    expect(buildPlan(ds, MON).remainingByModule.get(1)).toBeCloseTo(h - 1, 6);
    ds.sessions.push(session({ day: "2026-10-04", minutes: 600, moduleId: 1 }));
    expect(buildPlan(ds, MON).remainingByModule.get(1)).toBeCloseTo(h * 0.25, 6);
  });

  it("uses dated capacity changes", () => {
    const ds = makeDs(MON, {
      capacityChanges: [{ id: "c1", from: "2026-12-14", to: "2027-03-07", hours: 18, note: "Summer break" }],
    });
    expect(weeklyHoursOn(ds.profile, "2027-01-04").hours).toBe(18);
    const p = buildPlan(ds, MON);
    expect(p.capacityHours).toBeCloseTo(312 + 72, 6);
    expect(p.weeks.find((w) => w.start === "2027-01-04")?.note).toBe("Summer break");
  });

  it("measures pace from the last complete weeks and flags when it falls short", () => {
    const ds = makeDs(MON, { startDate: "2026-09-07" });
    for (const w of ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]) {
      ds.sessions.push(session({ day: w, minutes: 360 }));
    }
    const p = buildPlan(ds, MON);
    expect(p.measuredPace).toBeCloseTo(6, 6);
    expect(p.measuredWeeks).toBe(4);
    expect(p.verdict).toBe("behind");
    expect(p.finishAtPace).toBe("2027-09-18");
    expect(p.weeks.filter((w) => w.phase === "past")).toHaveLength(4);
  });

  it("needs two complete weeks before it trusts a pace", () => {
    const ds = makeDs(MON, { startDate: "2026-09-28" });
    ds.sessions.push(session({ day: "2026-09-28", minutes: 720 }));
    const p = buildPlan(ds, MON);
    expect(p.measuredPace).toBeNull();
    expect(p.verdict).toBe("unknown");
  });

  it("reports content left once the mock phase has started", () => {
    const day = "2027-04-12";
    const p = buildPlan(makeDs(day, { startDate: MON }), day);
    expect(p.inMockPhase).toBe(true);
    expect(p.capacityHours).toBe(0);
    expect(p.requiredWeekly).toBeNull();
    expect(p.fits).toBe(false);
  });
});
