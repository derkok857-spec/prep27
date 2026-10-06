import { describe, expect, it } from "vitest";
import { addDays, diffDays, eachDay, endOfWeek, fmtRange, isISODate, isSunday, startOfWeek, todayIn, weekday } from "@/lib/dates";

describe("dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(diffDays("2026-10-05", "2027-05-11")).toBe(218);
  });

  it("starts weeks on Monday", () => {
    expect(weekday("2026-10-05")).toBe(0);
    expect(isSunday("2026-10-11")).toBe(true);
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
    expect(endOfWeek("2026-10-05")).toBe("2026-10-11");
    expect(startOfWeek("2027-05-11")).toBe("2027-05-10");
  });

  it("rejects impossible dates", () => {
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-2-3")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
  });

  it("reads today in a given time zone", () => {
    const t = new Date("2026-10-06T03:00:00Z");
    expect(todayIn("America/Lima", t)).toBe("2026-10-05");
    expect(todayIn("UTC", t)).toBe("2026-10-06");
  });

  it("lists days and formats ranges", () => {
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(fmtRange("2026-10-05", "2026-10-11")).toBe("Oct 5–11");
    expect(fmtRange("2026-10-26", "2026-11-01")).toBe("Oct 26 – Nov 1");
  });
});
