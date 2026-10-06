import { describe, expect, it } from "vitest";
import { dueMistakes, dueReviews, nextReview, recheckMistake, reviewSlots } from "@/lib/srs";
import { emptyProgress } from "@/lib/defaults";
import { makeDs, mistake, setProgress } from "./helpers";

describe("mistake re-checks", () => {
  it("comes back after 3, 7 and 21 days and retires after three clean checks", () => {
    let m = mistake({ moduleId: 4, createdOn: "2026-10-01" });
    expect(m.nextReview).toBe("2026-10-04");

    m = { ...m, ...recheckMistake(m, true, "2026-10-04") };
    expect(m.streak).toBe(1);
    expect(m.nextReview).toBe("2026-10-11");

    m = { ...m, ...recheckMistake(m, true, "2026-10-11") };
    expect(m.nextReview).toBe("2026-11-01");

    m = { ...m, ...recheckMistake(m, true, "2026-11-01") };
    expect(m.resolvedOn).toBe("2026-11-01");
    expect(m.nextReview).toBeNull();
    expect(m.history).toHaveLength(3);
  });

  it("resets the streak on a miss", () => {
    let m = mistake({ moduleId: 4, createdOn: "2026-10-01", streak: 2 });
    m = { ...m, ...recheckMistake(m, false, "2026-10-20") };
    expect(m.streak).toBe(0);
    expect(m.nextReview).toBe("2026-10-23");
    expect(m.resolvedOn).toBeNull();
  });

  it("lists due mistakes oldest first and skips resolved ones", () => {
    const a = mistake({ moduleId: 1, createdOn: "2026-09-20" });
    const b = mistake({ moduleId: 2, createdOn: "2026-09-25" });
    const c = mistake({ moduleId: 3, createdOn: "2026-09-20", resolvedOn: "2026-10-01", nextReview: null });
    const d = mistake({ moduleId: 4, createdOn: "2026-10-04" });
    expect(dueMistakes([d, b, c, a], "2026-10-05").map((m) => m.moduleId)).toEqual([1, 2]);
  });
});

describe("module reviews", () => {
  it("schedules recall one day, one week and one month after finishing", () => {
    const p = { ...emptyProgress(1), status: "done" as const, doneAt: "2026-10-01" };
    expect(reviewSlots(p).map((s) => s.due)).toEqual(["2026-10-02", "2026-10-08", "2026-10-31"]);
  });

  it("pushes the next review when a review is done late", () => {
    const p = { ...emptyProgress(1), status: "done" as const, doneAt: "2026-10-01", reviews: { r1: "2026-10-07" } };
    expect(nextReview(p)).toMatchObject({ key: "r7", due: "2026-10-10" });
  });

  it("shows only the next pending review of each module", () => {
    const ds = makeDs("2026-10-20");
    setProgress(ds, 4, { status: "done", doneAt: "2026-10-01" });
    setProgress(ds, 5, { status: "done", doneAt: "2026-10-19" });
    setProgress(ds, 6, { status: "reading" });
    const due = dueReviews(ds, "2026-10-20");
    expect(due.map((d) => [d.moduleId, d.key])).toEqual([
      [4, "r1"],
      [5, "r1"],
    ]);
    expect(due[0].overdueDays).toBe(18);
  });
});
