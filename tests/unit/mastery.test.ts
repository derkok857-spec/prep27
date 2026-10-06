import { describe, expect, it } from "vitest";
import { accuracy, allTopicStats, band, masteryMap, masteryValue, practiceEvents, progressAsOf, readiness } from "@/lib/mastery";
import { emptyProgress } from "@/lib/defaults";
import { answer, attempt, makeDs, question, setProgress } from "./helpers";

const TODAY = "2026-10-05";

describe("mastery", () => {
  it("returns null when there is nothing to judge", () => {
    expect(masteryValue(emptyProgress(1), { c: 0, n: 0, raw: 0, rawN: 0 })).toBeNull();
    // reading alone is not evidence
    expect(masteryValue({ ...emptyProgress(1), status: "reading" }, { c: 0, n: 0, raw: 0, rawN: 0 })).toBeNull();
  });

  it("treats a finished module with no practice as unproven", () => {
    const v = masteryValue({ ...emptyProgress(1), status: "done", doneAt: TODAY }, { c: 0, n: 0, raw: 0, rawN: 0 });
    expect(v).toBeCloseTo(0.4, 10);
    expect(band(v)).toBe("low");
  });

  it("combines accuracy, confidence and reviews", () => {
    const p = {
      ...emptyProgress(1),
      status: "done" as const,
      doneAt: TODAY,
      confidence: 3 as const,
      reviews: { r1: TODAY, r7: TODAY, r30: TODAY },
    };
    const v = masteryValue(p, { c: 8, n: 10, raw: 8, rawN: 10 });
    expect(v).toBeCloseTo(0.6 * (10 / 14) + 0.2 + 0.2, 10);
    expect(band(v)).toBe("high");
  });

  it("halves the weight of practice every 21 days", () => {
    const ev = [
      { day: "2026-09-14", moduleId: 1, topicId: "quant" as const, n: 10, c: 10, source: "qbank" as const },
      { day: TODAY, moduleId: 1, topicId: "quant" as const, n: 10, c: 0, source: "qbank" as const },
    ];
    const a = accuracy(ev, () => true, TODAY);
    expect(a.n).toBeCloseTo(15, 10);
    expect(a.c).toBeCloseTo(5, 10);
    expect(a.rawN).toBe(20);
    // windowed
    expect(accuracy(ev, () => true, TODAY, 7).rawN).toBe(10);
  });

  it("counts only the first answer to a Lab question", () => {
    const ds = makeDs(TODAY);
    const q = question({ moduleId: 4 });
    ds.questions = [q];
    ds.answers = [answer({ questionId: q.id, day: TODAY, correct: false }), answer({ questionId: q.id, day: TODAY, correct: true })];
    const ev = practiceEvents(ds);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ moduleId: 4, n: 1, c: 0, topicId: "quant", source: "lab" });
  });

  it("replays progress as of a past day", () => {
    const p = { ...emptyProgress(1), status: "done" as const, doneAt: "2026-09-20", reviews: { r1: "2026-09-21", r7: "2026-09-28" } };
    expect(progressAsOf(p, "2026-09-19").status).toBe("reading");
    expect(progressAsOf(p, "2026-09-25").reviews).toEqual({ r1: "2026-09-21" });
  });

  it("grows readiness with evidence and weights topics by exam weight", () => {
    const ds = makeDs(TODAY);
    expect(readiness(allTopicStats(masteryMap(ds, TODAY), ds))).toBe(0);

    setProgress(ds, 93, { status: "done", doneAt: TODAY, confidence: 3 }); // ethics, weight 17.5
    const rEthics = readiness(allTopicStats(masteryMap(ds, TODAY), ds));

    const ds2 = makeDs(TODAY);
    setProgress(ds2, 70, { status: "done", doneAt: TODAY, confidence: 3 }); // derivatives, weight 6.5
    const rDeriv = readiness(allTopicStats(masteryMap(ds2, TODAY), ds2));
    expect(rEthics).toBeGreaterThan(0);
    expect(rEthics).toBeGreaterThan(rDeriv);

    ds.attempts.push(attempt({ day: TODAY, moduleId: 93, questions: 20, correct: 18 }));
    expect(readiness(allTopicStats(masteryMap(ds, TODAY), ds))).toBeGreaterThan(rEthics);
  });
});
