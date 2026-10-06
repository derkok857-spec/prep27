import { describe, expect, it } from "vitest";
import { BackupError, exportBackup, parseBackup } from "@/lib/backup";
import { buildDemoDataset } from "@/lib/repo/demo";

const TODAY = "2026-10-05";

describe("backup", () => {
  it("round trips the demo dataset", () => {
    const ds = buildDemoDataset(TODAY);
    expect(parseBackup(exportBackup(ds), TODAY)).toEqual(ds);
  });

  it("refuses files that are not backups", () => {
    expect(() => parseBackup("not json", TODAY)).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }), TODAY)).toThrow(/not a Prep27 backup/);
  });

  it("drops malformed records instead of trusting them", () => {
    const ds = buildDemoDataset(TODAY);
    const raw = JSON.parse(exportBackup(ds));
    raw.data.attempts.push({
      id: "11111111-1111-4111-8111-111111111111",
      day: TODAY,
      moduleId: 4,
      questions: 5,
      correct: 9,
      source: "qbank",
    });
    raw.data.sessions.push({ id: "x", day: "yesterday", minutes: 30 });
    raw.data.mistakes.push({ id: "22222222-2222-4222-8222-222222222222", moduleId: 999, createdOn: TODAY, description: "x" });
    raw.data.answers.push({
      id: "33333333-3333-4333-8333-333333333333",
      questionId: "44444444-4444-4444-8444-444444444444",
      day: TODAY,
      pick: "A",
    });
    raw.data.profile.weeklyHours = 500;
    const out = parseBackup(JSON.stringify(raw), TODAY);
    expect(out.attempts).toHaveLength(ds.attempts.length);
    expect(out.sessions).toHaveLength(ds.sessions.length);
    expect(out.mistakes).toHaveLength(ds.mistakes.length);
    expect(out.answers).toHaveLength(ds.answers.length);
    expect(out.profile.weeklyHours).toBe(80);
  });

  it("regrades answers from the question key", () => {
    const ds = buildDemoDataset(TODAY);
    const raw = JSON.parse(exportBackup(ds));
    raw.data.answers = raw.data.answers.map((a: { correct: boolean }) => ({ ...a, correct: true }));
    const out = parseBackup(JSON.stringify(raw), TODAY);
    expect(out.answers.filter((a) => !a.correct).length).toBe(ds.answers.filter((a) => !a.correct).length);
  });
});
