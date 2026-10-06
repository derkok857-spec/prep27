// Deterministic demo dataset: seven weeks of a believable study log that ends the day before `today`.
// It powers the public demo and the end to end tests, so every date is relative to `today`.

import { EXAM_WINDOW } from "../curriculum";
import { addDays, isSunday, maxDate, startOfWeek, type ISODate } from "../dates";
import { DEFAULT_TARGET_HOURS, defaultProfile, emptyProgress } from "../defaults";
import { MISTAKE_STEPS } from "../srs";
import type {
  AiBatch,
  AiQuestion,
  Certainty,
  Confidence,
  Dataset,
  ErrorType,
  Letter,
  Mistake,
  MistakeSource,
  PracticeAttempt,
  QuestionAnswer,
  QuestionRequest,
  StudySession,
} from "../types";
import { DEMO_QUESTIONS } from "./demo-questions";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Module id -> day (offset from the start Monday) it was finished. Sundays are left for reviews. */
const DONE_DAY: Record<number, number> = {
  1: 1,
  2: 3,
  3: 5,
  4: 8,
  5: 10,
  6: 12,
  7: 15,
  8: 17,
  9: 18,
  10: 21,
  11: 23,
  12: 25,
  13: 30,
  14: 33,
  15: 36,
  16: 37,
  17: 39,
  18: 40,
  19: 43,
  20: 45,
  21: 46,
  22: 47,
};
const READING = 23;
/** Share of questions answered right, per module. */
const SKILL: Record<number, number> = {
  1: 0.85,
  2: 0.72,
  3: 0.78,
  4: 0.8,
  5: 0.66,
  6: 0.7,
  7: 0.48,
  8: 0.6,
  9: 0.74,
  10: 0.7,
  11: 0.76,
  12: 0.72,
  13: 0.64,
  14: 0.62,
  15: 0.66,
  16: 0.75,
  17: 0.7,
  18: 0.55,
  19: 0.45,
  20: 0.78,
  21: 0.74,
  22: 0.7,
};
const SKIPPED_REVIEWS: [number, "r1" | "r7" | "r30"][] = [
  [7, "r30"],
  [17, "r7"],
  [18, "r7"],
  [22, "r1"],
];
const NOTES: Record<number, string> = {
  4: "BGN mode for annuity due. P/Y and C/Y both 1 unless the problem says otherwise. Effective annual rate before comparing offers.",
  7: "Two tailed test, reject when |t| is beyond the critical value. Lower alpha means a wider acceptance region.",
  19: "Write every quote as price currency over base currency and cancel. Forward points are divided by 10,000.",
};

interface MistakeSeed {
  key: string;
  moduleId: number;
  day: number;
  type: ErrorType;
  certainty: Certainty | null;
  source: MistakeSource;
  description: string;
  lesson: string;
  /** offsets of re-checks and their result */
  checks: [number, boolean][];
  question?: string;
}

const MISTAKES: MistakeSeed[] = [
  {
    key: "m1",
    moduleId: 4,
    day: 9,
    type: "calc",
    certainty: "unsure",
    source: "qbank",
    description: "Left the calculator in END mode for an annuity due.",
    lesson: "Check BGN or END before any annuity. Payments at the start of each period mean BGN.",
    checks: [
      [12, true],
      [19, true],
      [40, true],
    ],
  },
  {
    key: "m2",
    moduleId: 2,
    day: 11,
    type: "formula",
    certainty: "sure",
    source: "qbank",
    description: "Annualized a monthly return by multiplying by 12 instead of compounding.",
    lesson: "Annualize with (1 + r)^12 − 1 unless the question says simple interest.",
    checks: [
      [14, true],
      [21, true],
      [42, true],
    ],
  },
  {
    key: "m3",
    moduleId: 5,
    day: 16,
    type: "formula",
    certainty: "unsure",
    source: "qbank",
    description: "Used the population variance formula on a sample.",
    lesson: "Sample variance divides by n − 1.",
    checks: [
      [19, true],
      [26, true],
    ],
  },
  {
    key: "m4",
    moduleId: 7,
    day: 22,
    type: "concept",
    certainty: "sure",
    source: "qbank",
    description: "Rejected the null although the test statistic was inside the critical values.",
    lesson: "Reject only when the statistic lands in the rejection region, beyond the critical value.",
    checks: [
      [25, false],
      [28, false],
      [31, true],
      [38, true],
    ],
  },
  {
    key: "m7",
    moduleId: 8,
    day: 25,
    type: "formula",
    certainty: "guess",
    source: "qbank",
    description: "Dropped the covariance term in a two asset portfolio variance.",
    lesson: "Portfolio variance has three terms. The cross term is 2 × w1 × w2 × ρ × σ1 × σ2.",
    checks: [
      [28, true],
      [35, true],
    ],
  },
  {
    key: "m8",
    moduleId: 13,
    day: 31,
    type: "misread",
    certainty: "unsure",
    source: "qbank",
    description: "Answered with a leading indicator when the question asked for a lagging one.",
    lesson: "Circle leading, coincident or lagging before reading the options.",
    checks: [[34, true]],
  },
  {
    key: "m9",
    moduleId: 15,
    day: 37,
    type: "concept",
    certainty: "sure",
    source: "qbank",
    description: "Said that buying bonds tightens monetary policy.",
    lesson: "Central bank buys bonds, reserves rise and rates fall. Buying eases.",
    checks: [
      [40, true],
      [47, true],
    ],
  },
  {
    key: "m13",
    moduleId: 18,
    day: 40,
    type: "concept",
    certainty: "unsure",
    source: "qbank",
    description: "Got the effect of capital inflows on the currency backwards.",
    lesson: "Inflows raise demand for the domestic currency, so it tends to appreciate.",
    checks: [[43, true]],
  },
  {
    key: "m5",
    moduleId: 7,
    day: 42,
    type: "concept",
    certainty: "sure",
    source: "lab",
    description: "Lab question. Thought a lower significance level raises the power of the test.",
    lesson: "Lower alpha means fewer Type I errors, more Type II errors and less power.",
    checks: [[45, true]],
    question: "alpha",
  },
  {
    key: "m6",
    moduleId: 2,
    day: 42,
    type: "formula",
    certainty: "unsure",
    source: "lab",
    description: "Lab question. Used the arithmetic mean when the question asked for the geometric mean return.",
    lesson: "Compound growth uses the geometric mean. The arithmetic mean overstates it when returns vary.",
    checks: [],
    question: "geo",
  },
  {
    key: "m10",
    moduleId: 19,
    day: 43,
    type: "formula",
    certainty: "unsure",
    source: "qbank",
    description: "Multiplied two quotes when the shared currency only cancels by dividing.",
    lesson: "Write cross rates as fractions so the shared currency cancels before any arithmetic.",
    checks: [],
  },
  {
    key: "m11",
    moduleId: 19,
    day: 44,
    type: "calc",
    certainty: "guess",
    source: "topic_test",
    description: "Applied forward points to the wrong side of the quote.",
    lesson: "Forward points go on the spot quote in the same convention, scaled by 10,000.",
    checks: [],
  },
  {
    key: "m12",
    moduleId: 19,
    day: 44,
    type: "formula",
    certainty: "sure",
    source: "topic_test",
    description: "Swapped the domestic and foreign rates in covered interest rate parity.",
    lesson: "Forward = spot × (1 + price currency rate) / (1 + base currency rate).",
    checks: [],
  },
  {
    key: "m14",
    moduleId: 14,
    day: 45,
    type: "formula",
    certainty: "guess",
    source: "qbank",
    description: "Used the simple spending multiplier although the question included an income tax.",
    lesson: "With a tax rate t the multiplier is 1 / [1 − MPC × (1 − t)].",
    checks: [],
  },
];

const BATCH1_KEYS = ["hpr", "cv", "geo", "perfcomp", "r2", "alpha"];
const BATCH1_PICKS: Record<string, [Letter, Certainty]> = {
  hpr: ["C", "sure"],
  cv: ["B", "unsure"],
  geo: ["B", "unsure"],
  perfcomp: ["A", "sure"],
  r2: ["C", "unsure"],
  alpha: ["C", "sure"],
};

export function buildDemoDataset(today: ISODate): Dataset {
  const rnd = mulberry32(20270511);
  const uuid = () => {
    const h = () =>
      Math.floor(rnd() * 0x10000)
        .toString(16)
        .padStart(4, "0");
    return `${h()}${h()}-${h()}-4${h().slice(1)}-${(8 + Math.floor(rnd() * 4)).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
  };
  const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

  const start = addDays(startOfWeek(today), -49);
  const D = (k: number) => addDays(start, k);
  const past = (k: number) => D(k) < today;

  // ---------- profile ----------
  const profile = defaultProfile(start);
  profile.examDate = today <= "2027-03-01" ? EXAM_WINDOW.start : addDays(today, 200);
  const finalsFrom = addDays(startOfWeek(today), 56);
  profile.capacityChanges = [
    { id: "midterms", from: D(28), to: D(34), hours: 4, note: "Midterms" },
    { id: "finals", from: finalsFrom, to: addDays(finalsFrom, 13), hours: 6, note: "Finals" },
    { id: "summer", from: addDays(finalsFrom, 14), to: addDays(finalsFrom, 97), hours: 18, note: "Summer break" },
  ];

  // ---------- module progress ----------
  const progress: Dataset["progress"] = {};
  for (const [idStr, day] of Object.entries(DONE_DAY)) {
    const id = Number(idStr);
    if (!past(day)) continue;
    const doneAt = D(day);
    const skill = SKILL[id];
    const confidence: Confidence = skill >= 0.75 ? 3 : skill >= 0.62 ? 2 : 1;
    const reviews: Dataset["progress"][number]["reviews"] = {};
    for (const [key, offset] of [
      ["r1", 1],
      ["r7", 7],
      ["r30", 30],
    ] as const) {
      let d = addDays(doneAt, offset);
      if (isSunday(d) && key === "r1") d = addDays(d, 1);
      if (d >= today) break;
      if (SKIPPED_REVIEWS.some(([m, k]) => m === id && k === key)) break;
      reviews[key] = d;
    }
    progress[id] = { ...emptyProgress(id), status: "done", doneAt, confidence, reviews, notes: NOTES[id] ?? "" };
  }
  progress[READING] = { ...emptyProgress(READING), status: "reading" };

  // ---------- study sessions ----------
  const sessions: StudySession[] = [];
  const order = Object.keys(DONE_DAY).map(Number);
  const moduleOn = (k: number) => order.find((id) => DONE_DAY[id] >= k) ?? READING;
  for (let k = 0; D(k) < today; k++) {
    const day = D(k);
    if (isSunday(day)) {
      sessions.push({ id: uuid(), day, minutes: between(30, 50), moduleId: null, kind: "review", note: "Spaced reviews" });
      continue;
    }
    const midterms = k >= 28 && k <= 34;
    if (midterms && k !== 30 && k !== 33) continue;
    const finishing = Object.values(DONE_DAY).includes(k);
    if (!midterms && !finishing && rnd() < 0.14) continue;
    const mod = moduleOn(k);
    sessions.push({
      id: uuid(),
      day,
      minutes: midterms ? 50 : between(60, 115),
      moduleId: mod,
      kind: "learn",
      note: "",
    });
  }

  // ---------- practice ----------
  const attempts: PracticeAttempt[] = [];
  const block = (
    k: number,
    moduleId: number | null,
    n: number,
    p: number,
    source: PracticeAttempt["source"],
    topicId: PracticeAttempt["topicId"] = null,
  ) => {
    if (!past(k)) return;
    const correct = Math.max(0, Math.min(n, Math.round(n * p + (rnd() - 0.5) * 2)));
    attempts.push({
      id: uuid(),
      day: D(k),
      moduleId,
      topicId: moduleId ? null : topicId,
      questions: n,
      correct,
      minutes: Math.round(n * 1.5),
      source,
    });
  };
  for (const id of order) {
    block(DONE_DAY[id], id, between(12, 20), SKILL[id], "qbank");
  }
  for (const id of [2, 4, 5, 7, 8, 13, 15, 18]) {
    const k = DONE_DAY[id] + between(5, 9);
    block(isSunday(D(k)) ? k : k + (6 - (k % 7)), id, 10, Math.min(0.95, SKILL[id] + 0.04), "qbank");
  }
  block(26, null, 30, 0.67, "topic_test", "quant");
  block(44, null, 30, 0.57, "topic_test", "econ");

  // ---------- AI batches and questions ----------
  const qid = new Map(DEMO_QUESTIONS.map((q) => [q.key, uuid()]));
  const requestServed: QuestionRequest = {
    id: uuid(),
    createdOn: D(44),
    topicId: null,
    moduleId: 15,
    difficulty: 1,
    count: 3,
    note: "Open market operations",
    servedBatchId: null,
  };
  const batches: AiBatch[] = [];
  const questions: AiQuestion[] = [];
  const mkBatch = (k: number, keys: string[], summary: string, patterns: AiBatch["patterns"], discarded: number, served: string[]) => {
    if (!past(k + 1) && D(k + 1) !== today) return null;
    const b: AiBatch = {
      id: uuid(),
      createdAt: `${D(k + 1)}T00:48:00.000Z`,
      summary,
      patterns,
      meta: { discarded, servedRequests: served, runKey: D(k) },
    };
    batches.push(b);
    for (const key of keys) {
      const q = DEMO_QUESTIONS.find((x) => x.key === key)!;
      questions.push({
        id: qid.get(key)!,
        batchId: b.id,
        moduleId: q.moduleId,
        difficulty: q.difficulty,
        origin: q.origin,
        ref: q.origin === "request" ? requestServed.id : null,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        verification: q.verification,
        createdAt: b.createdAt,
      });
    }
    return b;
  };

  // ---------- mistakes ----------
  const mistakes: Mistake[] = [];
  const mid = new Map<string, string>();
  for (const s of MISTAKES) {
    if (!past(s.day)) continue;
    const id = uuid();
    mid.set(s.key, id);
    const history = s.checks.filter(([k]) => past(k)).map(([k, ok]) => ({ day: D(k), ok }));
    let streak = 0;
    let nextReview: ISODate | null = addDays(D(s.day), MISTAKE_STEPS[0]);
    let resolvedOn: ISODate | null = null;
    for (const h of history) {
      if (h.ok) {
        streak++;
        if (streak >= MISTAKE_STEPS.length) {
          resolvedOn = h.day;
          nextReview = null;
        } else nextReview = addDays(h.day, MISTAKE_STEPS[streak]);
      } else {
        streak = 0;
        nextReview = addDays(h.day, MISTAKE_STEPS[0]);
      }
    }
    mistakes.push({
      id,
      moduleId: s.moduleId,
      createdOn: D(s.day),
      description: s.description,
      lesson: s.lesson,
      errorType: s.type,
      certainty: s.certainty,
      source: s.source,
      nextReview,
      streak,
      resolvedOn,
      questionId: s.question ? (qid.get(s.question) ?? null) : null,
      history,
    });
  }

  const b1 = mkBatch(
    41,
    BATCH1_KEYS,
    "First full batch. Quant practice sits around 70% and Economics just started. These questions target returns, dispersion and the first hypothesis testing ideas, plus a market structure warm up.",
    [],
    1,
    [],
  );
  const ev = (k: string) => mid.get(k);
  const b2 = mkBatch(
    48,
    ["fvq", "port", "cross", "omo", "lifo", "bond", "plag", "fwd", "ddm"],
    "Good volume this week on Economics, but your misses keep landing in two places. Exchange rate math has three open mistakes with the same root cause, and hypothesis testing shows confident misses. This batch adds a cross rate drill, a portfolio risk check, your open market operations request and a preview of the topics after Corporate Finance. Two questions were discarded in verification.",
    [
      {
        title: "Cross rates and parity, the same slip three times",
        detail:
          "All three open mistakes in Exchange Rate Calculations come from lining the quotes up the wrong way. Two are formula errors and one a calculation slip, and you were sure on one of them.",
        evidence: [ev("m10"), ev("m11"), ev("m12")].filter((x): x is string => Boolean(x)),
        modules: [19],
        action:
          "Before any FX question write both quotes as fractions, price currency over base currency, and cancel the shared currency on paper.",
      },
      {
        title: "Hypothesis testing decisions",
        detail:
          "You missed the reject or fail to reject call twice in re-checks and once in the Lab, sure every time. That points to a rule held the wrong way round, not a gap.",
        evidence: [ev("m4"), ev("m5")].filter((x): x is string => Boolean(x)),
        modules: [7],
        action:
          "Draw the rejection region of a two tailed test at 5% and at 1% and place three test statistics on it, then redo the Lab question on significance and power.",
      },
    ],
    2,
    [requestServed.id],
  );
  if (b2) requestServed.servedBatchId = b2.id;

  // ---------- Lab answers for the first batch ----------
  const answers: QuestionAnswer[] = [];
  if (b1 && past(42)) {
    for (const key of BATCH1_KEYS) {
      const q = DEMO_QUESTIONS.find((x) => x.key === key)!;
      const [pick, certainty] = BATCH1_PICKS[key];
      answers.push({ id: uuid(), questionId: qid.get(key)!, day: D(42), pick, correct: pick === q.answer, certainty });
    }
  }

  const requests: QuestionRequest[] = [];
  if (past(44)) requests.push(requestServed);
  if (past(48)) {
    requests.push({
      id: uuid(),
      createdOn: maxDate(D(48), addDays(today, -1)),
      topicId: null,
      moduleId: READING,
      difficulty: 2,
      count: 6,
      note: "Cash conversion cycle and liquidity ratios",
      servedBatchId: null,
    });
  }

  return {
    profile: { ...profile, targetHours: DEFAULT_TARGET_HOURS },
    progress,
    sessions,
    attempts: attempts.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)),
    mistakes,
    batches,
    questions,
    answers,
    requests,
    reports: [],
  };
}
