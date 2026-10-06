import { describe, expect, it } from "vitest";
import { MODULES, TOPICS, TOTAL_WEIGHT_MID, baseHours, getModule, isModuleId, moduleLabel, modulesOf, weightMid } from "@/lib/curriculum";

describe("curriculum", () => {
  it("has the 102 learning modules of the 2027 outline with contiguous ids", () => {
    expect(MODULES).toHaveLength(102);
    MODULES.forEach((m, i) => expect(m.id).toBe(i + 1));
    expect(new Set(MODULES.map((m) => m.title)).size).toBe(102);
  });

  it("splits modules by topic as in the outline", () => {
    const counts = TOPICS.map((t) => modulesOf(t.id).length);
    expect(counts).toEqual([11, 8, 7, 12, 12, 19, 10, 7, 6, 10]);
    for (const t of TOPICS) {
      expect(modulesOf(t.id).map((m) => m.lm)).toEqual(modulesOf(t.id).map((_, i) => i + 1));
    }
  });

  it("uses the 2027 weight ranges", () => {
    expect(TOTAL_WEIGHT_MID).toBe(102.5);
    const ethics = TOPICS.find((t) => t.id === "ethics")!;
    expect([ethics.weightMin, ethics.weightMax]).toEqual([15, 20]);
    expect(weightMid(ethics)).toBe(17.5);
  });

  it("spreads the hours budget so it adds back up to the target", () => {
    const sum = MODULES.reduce((a, m) => a + baseHours(m.id, 300), 0);
    expect(sum).toBeCloseTo(300, 9);
    // Ethics gets more hours per module than Fixed Income, fewer modules and a bigger weight
    expect(baseHours(93, 300)).toBeGreaterThan(baseHours(51, 300));
  });

  it("labels modules by topic and position", () => {
    expect(moduleLabel(4)).toBe("Quant LM4");
    expect(getModule(4)?.title).toBe("The Time Value of Money in Finance");
    expect(moduleLabel(102)).toBe("Ethics LM10");
    expect(isModuleId(103)).toBe(false);
  });
});
