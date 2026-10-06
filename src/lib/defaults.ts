import { DEFAULT_TOPIC_ORDER, EXAM_WINDOW, MODULES, TOPIC_IDS, isTopicId } from "./curriculum";
import { isISODate, type ISODate } from "./dates";
import type { CapacityChange, Dataset, ModuleProgress, Profile } from "./types";

export const DEFAULT_EXAM_DATE = EXAM_WINDOW.start;
export const DEFAULT_WEEKLY_HOURS = 12;
export const DEFAULT_MOCK_WEEKS = 5;
export const DEFAULT_TARGET_HOURS = 300;

export function defaultProfile(today: ISODate): Profile {
  return {
    examDate: DEFAULT_EXAM_DATE,
    weeklyHours: DEFAULT_WEEKLY_HOURS,
    startDate: today,
    mockWeeks: DEFAULT_MOCK_WEEKS,
    topicOrder: [...DEFAULT_TOPIC_ORDER],
    capacityChanges: [],
    targetHours: DEFAULT_TARGET_HOURS,
  };
}

export function emptyProgress(moduleId: number): ModuleProgress {
  return {
    moduleId,
    status: "todo",
    confidence: null,
    doneAt: null,
    reviews: {},
    notes: "",
    hoursOverride: null,
  };
}

export function emptyDataset(today: ISODate): Dataset {
  return {
    profile: defaultProfile(today),
    progress: {},
    sessions: [],
    attempts: [],
    mistakes: [],
    batches: [],
    questions: [],
    answers: [],
    requests: [],
    reports: [],
  };
}

export function progressOf(ds: Pick<Dataset, "progress">, moduleId: number): ModuleProgress {
  return ds.progress[moduleId] ?? emptyProgress(moduleId);
}

const clampNum = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
};

/** Repairs a profile that came from storage or the database so the rest of the app can trust it. */
export function normalizeProfile(raw: Partial<Profile> | null | undefined, today: ISODate): Profile {
  const base = defaultProfile(today);
  if (!raw) return base;
  const order = Array.isArray(raw.topicOrder) ? raw.topicOrder.filter(isTopicId) : [];
  const seen = new Set(order);
  const topicOrder = [...order.filter((t, i) => order.indexOf(t) === i), ...TOPIC_IDS.filter((t) => !seen.has(t))];
  const changes: CapacityChange[] = Array.isArray(raw.capacityChanges)
    ? raw.capacityChanges
        .filter((c) => c && isISODate(c.from) && isISODate(c.to) && c.from <= c.to)
        .map((c) => ({
          id: String(c.id || `${c.from}-${c.to}`),
          from: c.from,
          to: c.to,
          hours: clampNum(c.hours, 0, 80, base.weeklyHours),
          note: String(c.note ?? "").slice(0, 120),
        }))
    : [];
  return {
    examDate: isISODate(raw.examDate) ? raw.examDate : base.examDate,
    weeklyHours: clampNum(raw.weeklyHours, 1, 80, base.weeklyHours),
    startDate: isISODate(raw.startDate) ? raw.startDate : base.startDate,
    mockWeeks: Math.round(clampNum(raw.mockWeeks, 0, 12, base.mockWeeks)),
    topicOrder,
    capacityChanges: changes,
    targetHours: clampNum(raw.targetHours, 50, 1000, base.targetHours),
  };
}

export const ALL_MODULE_IDS = MODULES.map((m) => m.id);
