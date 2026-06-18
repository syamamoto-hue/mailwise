import {
  differenceInDays,
  subDays,
  parseISO,
  format,
  isValid,
} from "date-fns";

// All dates in the app are handled as date-only ISO strings: "yyyy-MM-dd".

export function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateOnly(iso: string): Date {
  // Parse "yyyy-MM-dd" as a local date (avoid timezone shifting).
  return parseISO(iso);
}

export function todayISO(): string {
  return toISO(new Date());
}

/**
 * Number of days between two ISO date strings (a - b).
 * Positive when `a` is later than `b`.
 */
export function diffDays(aIso: string, bIso: string): number {
  return differenceInDays(parseDateOnly(aIso), parseDateOnly(bIso));
}

/**
 * Compute the offset days from a webinar date and an absolute task date.
 * offset = differenceInDays(webinarDate, taskDate)
 * e.g. webinar 2026-07-29, due 2026-07-22 => 7
 */
export function offsetFromDate(
  webinarDateIso: string,
  taskDateIso: string | null | undefined
): number | null {
  if (!taskDateIso) return null;
  return diffDays(webinarDateIso, taskDateIso);
}

/**
 * Compute the absolute date from a webinar date and an offset.
 * date = webinarDate - offsetDays
 * e.g. webinar 2026-07-29, dueOffset 7 => 2026-07-22
 */
export function dateFromOffset(
  webinarDateIso: string,
  offsetDays: number | null | undefined
): string | null {
  if (offsetDays === null || offsetDays === undefined) return null;
  return toISO(subDays(parseDateOnly(webinarDateIso), offsetDays));
}

/**
 * Re-materialize a task's startDate / dueDate from its offsets and a webinar date.
 * Manually overridden tasks keep their existing absolute dates.
 */
export function materializeTaskDates(
  webinarDateIso: string,
  task: {
    startOffsetDays?: number | null;
    dueOffsetDays?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    isManuallyOverridden?: boolean | null;
  }
): { startDate: string | null; dueDate: string | null } {
  if (task.isManuallyOverridden) {
    return {
      startDate: task.startDate ?? null,
      dueDate: task.dueDate ?? null,
    };
  }
  return {
    startDate: dateFromOffset(webinarDateIso, task.startOffsetDays),
    dueDate: dateFromOffset(webinarDateIso, task.dueOffsetDays),
  };
}

/**
 * Parse a date coming from a CSV cell. Supports:
 *  - ISO "yyyy-MM-dd" / "yyyy/MM/dd"
 *  - Japanese "M月D日" (year inferred from `yearHint`)
 * Returns an ISO string or null when empty/unparseable.
 */
export function parseFlexibleDate(
  raw: string | null | undefined,
  yearHint: number
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // Japanese "7月29日" / "7月29日（火）"
  const jp = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (jp) {
    const month = Number(jp[1]);
    const day = Number(jp[2]);
    const d = new Date(yearHint, month - 1, day);
    if (isValid(d)) return toISO(d);
  }

  // ISO-ish "2026-07-29" or "2026/07/29"
  const iso = s.replace(/\//g, "-");
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isValid(d)) return toISO(d);
  }

  return null;
}

/** Format an ISO date for display (e.g. "7/29 (火)"). Returns "" for null. */
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
export function formatDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseDateOnly(iso);
  if (!isValid(d)) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS_JA[d.getDay()]})`;
}

export function isOverdue(
  dueIso: string | null | undefined,
  status: string,
  todayIso = todayISO()
): boolean {
  if (!dueIso) return false;
  if (status === "完了" || status === "不要") return false;
  return diffDays(dueIso, todayIso) < 0;
}
