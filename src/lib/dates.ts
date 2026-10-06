// Calendar days as ISO strings (YYYY-MM-DD). All arithmetic runs in UTC so no time zone or DST can shift a day.

export type ISODate = string;

const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function isISODate(v: unknown): v is ISODate {
  if (typeof v !== "string" || !ISO_RE.test(v)) return false;
  const t = toTime(v);
  return !Number.isNaN(t) && fromTime(t) === v;
}

export function toTime(d: ISODate): number {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
}

export function fromTime(t: number): ISODate {
  return new Date(t).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromTime(toTime(d) + n * DAY_MS);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toTime(b) - toTime(a)) / DAY_MS);
}

/** 0 = Monday ... 6 = Sunday */
export function weekday(d: ISODate): number {
  return (new Date(toTime(d)).getUTCDay() + 6) % 7;
}

export function isSunday(d: ISODate): boolean {
  return weekday(d) === 6;
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekday(d));
}

export function endOfWeek(d: ISODate): ISODate {
  return addDays(startOfWeek(d), 6);
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Today in a given IANA time zone (default: the runtime's own zone). */
export function todayIn(timeZone?: string, now: Date = new Date()): ISODate {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(now);
}

export function fmtDay(d: ISODate): string {
  const [, m, dd] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${dd}`;
}

export function fmtDayYear(d: ISODate): string {
  const [y, m, dd] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${dd}, ${y}`;
}

export function fmtWeekday(d: ISODate): string {
  return `${WEEKDAYS[weekday(d)]}, ${fmtDay(d)}`;
}

export function fmtRange(a: ISODate, b: ISODate): string {
  const [, ma] = a.split("-").map(Number);
  const [, mb, db] = b.split("-").map(Number);
  if (ma === mb) return `${fmtDay(a)}–${db}`;
  return `${fmtDay(a)} – ${MONTHS[mb - 1]} ${db}`;
}

export function relDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 0) return `in ${n} days`;
  return `${-n} days ago`;
}
