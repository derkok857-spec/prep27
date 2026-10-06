import { describe, expect, it } from "vitest";
import { squarify } from "@/lib/treemap";

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

describe("squarify", () => {
  const values = [17.5, 12.5, 12.5, 12.5, 10, 8.5, 7.5, 7.5, 7.5, 6.5];
  const rects = squarify(
    values.map((v, i) => ({ value: v, data: i })),
    0,
    0,
    1000,
    400,
  );

  it("keeps every item with an area proportional to its value", () => {
    expect(rects).toHaveLength(values.length);
    const total = values.reduce((a, b) => a + b, 0);
    for (const r of rects) expect(r.w * r.h).toBeCloseTo((r.value / total) * 400_000, 6);
  });

  it("stays inside the box without overlaps", () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(1000 + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-6);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBeLessThan(1e-6);
  });

  it("keeps aspect ratios reasonable", () => {
    const worst = Math.max(...rects.map((r) => Math.max(r.w / r.h, r.h / r.w)));
    expect(worst).toBeLessThan(4);
  });

  it("ignores empty input and zero values", () => {
    expect(squarify([], 0, 0, 10, 10)).toEqual([]);
    expect(squarify([{ value: 0, data: 1 }], 0, 0, 10, 10)).toEqual([]);
  });
});
