import Papa from "papaparse";
import { offsetFromDate, parseFlexibleDate, diffDays, formatDisplay } from "./dates";
import { TASK_STATUSES, type Task, type TaskStatus } from "./types";

export type ParsedImportTask = {
  largeCategory: string;
  middleCategory: string;
  smallCategory: string;
  company: string | null;
  assignee: string | null;
  status: TaskStatus;
  effortDays: number | null;
  startDate: string | null;
  dueDate: string | null;
  startOffsetDays: number | null;
  dueOffsetDays: number | null;
  note: string | null;
  sortOrder: number;
};

export type ParsedImport = {
  title: string;
  webinarDate: string | null;
  leadStartDate: string | null;
  firstMaterialShareDate: string | null;
  slideFixDate: string | null;
  tasks: ParsedImportTask[];
  warnings: string[];
};

function normalizeStatus(raw: string | undefined): TaskStatus {
  const s = (raw ?? "").trim();
  if ((TASK_STATUSES as readonly string[]).includes(s)) return s as TaskStatus;
  // Blank or unknown -> default to 未着手.
  return "未着手";
}

function cleanCell(v: string | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim();
}

function parseEffort(raw: string | undefined): number | null {
  const s = cleanCell(raw);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Choose the year so the parsed date lands closest to the webinar date. */
function parseNearWebinar(
  raw: string | undefined,
  webinarDateIso: string | null,
  defaultYear: number
): string | null {
  if (!webinarDateIso) return parseFlexibleDate(raw, defaultYear);
  const baseYear = Number(webinarDateIso.slice(0, 4));
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const y of [baseYear - 1, baseYear, baseYear + 1]) {
    const iso = parseFlexibleDate(raw, y);
    if (!iso) continue;
    const d = Math.abs(diffDays(iso, webinarDateIso));
    if (d < bestDiff) {
      bestDiff = d;
      best = iso;
    }
  }
  return best;
}

/**
 * Parse the Google-Sheets-exported CSV into a webinar + tasks structure.
 * The layout has a leading empty column; we locate the task header row
 * ("大カテゴリ" … "小カテゴリ") and read columns relative to it.
 */
export function parseWebinarCsv(text: string, fallbackYear: number): ParsedImport {
  const warnings: string[] = [];
  const { data } = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
  });
  const rows = data as string[][];

  const result: ParsedImport = {
    title: "",
    webinarDate: null,
    leadStartDate: null,
    firstMaterialShareDate: null,
    slideFixDate: null,
    tasks: [],
    warnings,
  };

  // Locate the task header row.
  let headerIdx = -1;
  const col = {
    large: 1,
    middle: 2,
    small: 3,
    company: 4,
    assignee: 5,
    status: 6,
    effort: 7,
    start: 8,
    due: 9,
    note: 10,
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(cleanCell);
    const largeAt = r.findIndex((c) => c === "大カテゴリ");
    if (largeAt >= 0 && r.includes("小カテゴリ")) {
      headerIdx = i;
      col.large = largeAt;
      col.middle = r.findIndex((c) => c === "中カテゴリ");
      col.small = r.findIndex((c) => c === "小カテゴリ");
      col.company = r.findIndex((c) => c === "会社");
      col.assignee = r.findIndex((c) => c === "担当者");
      col.status = r.findIndex((c) => c === "ステータス");
      col.effort = r.findIndex((c) => c.startsWith("工数"));
      col.start = r.findIndex((c) => c.includes("着手"));
      col.due = r.findIndex((c) => c.includes("期日"));
      col.note = r.findIndex((c) => c === "備考" || c === "参考情報");
      break;
    }
  }

  // Helper: find a parseable date in a row (prefer the known date column = 9).
  const findDateInRow = (r: string[]): string | undefined => {
    for (let c = r.length - 1; c >= 0; c--) {
      const v = cleanCell(r[c]);
      if (/\d{1,2}\s*月\s*\d{1,2}\s*日/.test(v) || /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v)) {
        return v;
      }
    }
    return undefined;
  };

  // Scan header area (everything before the task header) for title + key dates.
  const scanEnd = headerIdx >= 0 ? headerIdx : rows.length;
  for (let i = 0; i < scanEnd; i++) {
    const r = rows[i];
    const cells = r.map(cleanCell);
    const titleAt = cells.findIndex((c) => c === "ウェビナータイトル");
    if (titleAt >= 0) {
      const t = cells.slice(titleAt + 1).find((c) => c.length > 0);
      if (t) result.title = t;
    }
    const joined = cells.join("|");
    const dateRaw = findDateInRow(r);
    if (/集客開始/.test(joined)) result.leadStartDate = dateRaw ?? null;
    else if (/一次資料共有/.test(joined)) result.firstMaterialShareDate = dateRaw ?? null;
    else if (/ご講演資料FIX|資料FIX/.test(joined)) result.slideFixDate = dateRaw ?? null;
    else if (/開催日/.test(joined)) result.webinarDate = dateRaw ?? null;
  }

  // Resolve the webinar date first (anchor for everything else).
  const webinarYear = result.webinarDate
    ? // The raw is Japanese; we still need a year. Use fallbackYear to seed.
      Number(parseFlexibleDate(result.webinarDate, fallbackYear)?.slice(0, 4) ?? fallbackYear)
    : fallbackYear;
  const webinarIso = parseFlexibleDate(result.webinarDate ?? "", webinarYear);
  result.webinarDate = webinarIso;
  if (!webinarIso) warnings.push("開催日を特定できませんでした。インポート後に手動で設定してください。");

  result.leadStartDate = parseNearWebinar(result.leadStartDate ?? "", webinarIso, fallbackYear);
  result.firstMaterialShareDate = parseNearWebinar(
    result.firstMaterialShareDate ?? "",
    webinarIso,
    fallbackYear
  );
  result.slideFixDate = parseNearWebinar(result.slideFixDate ?? "", webinarIso, fallbackYear);

  // Parse task rows.
  if (headerIdx >= 0) {
    let order = 0;
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (idx: number) => (idx >= 0 ? cleanCell(r[idx]) : "");
      const large = get(col.large);
      const middle = get(col.middle);
      const small = get(col.small);
      // Skip fully empty rows.
      if (!large && !middle && !small && !get(col.note)) continue;

      const startDate = parseNearWebinar(get(col.start), webinarIso, webinarYear);
      const dueDate = parseNearWebinar(get(col.due), webinarIso, webinarYear);

      result.tasks.push({
        largeCategory: large,
        middleCategory: middle,
        smallCategory: small,
        company: get(col.company) || null,
        assignee: get(col.assignee) || null,
        status: normalizeStatus(get(col.status)),
        effortDays: parseEffort(get(col.effort)),
        startDate,
        dueDate,
        startOffsetDays: webinarIso ? offsetFromDate(webinarIso, startDate) : null,
        dueOffsetDays: webinarIso ? offsetFromDate(webinarIso, dueDate) : null,
        note: get(col.note) || null,
        sortOrder: order++,
      });
    }
  } else {
    warnings.push("タスクのヘッダー行（大カテゴリ…）が見つかりませんでした。");
  }

  return result;
}

const EXPORT_HEADER = [
  "大カテゴリ",
  "中カテゴリ",
  "小カテゴリ",
  "会社",
  "担当者",
  "ステータス",
  "工数（日数）",
  "着手日",
  "期日",
  "完了日",
  "備考",
];

/** Serialize a webinar's tasks to the export CSV format. */
export function tasksToCsv(tasks: Task[]): string {
  const rows = tasks.map((t) => [
    t.largeCategory,
    t.middleCategory,
    t.smallCategory,
    t.company ?? "",
    t.assignee ?? "",
    t.status,
    t.effortDays ?? "",
    t.startDate ?? "",
    t.dueDate ?? "",
    t.completedDate ?? "",
    t.note ?? "",
  ]);
  return Papa.unparse([EXPORT_HEADER, ...rows]);
}

export { formatDisplay };
