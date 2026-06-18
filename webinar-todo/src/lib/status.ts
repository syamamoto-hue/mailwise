import type { TaskStatus, WebinarStatus } from "./types";

// Tailwind class fragments per task status (badge style: bg + text + border).
export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  未着手: "bg-slate-100 text-slate-600 border-slate-200",
  着手中: "bg-blue-50 text-blue-700 border-blue-200",
  完了: "bg-emerald-50 text-emerald-700 border-emerald-200",
  保留: "bg-amber-50 text-amber-700 border-amber-200",
  不要: "bg-zinc-100 text-zinc-400 border-zinc-200 line-through",
};

// Small dot color used in lists / calendar.
export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  未着手: "bg-slate-400",
  着手中: "bg-blue-500",
  完了: "bg-emerald-500",
  保留: "bg-amber-500",
  不要: "bg-zinc-300",
};

export const WEBINAR_STATUS_STYLE: Record<WebinarStatus, string> = {
  準備中: "bg-blue-50 text-blue-700 border-blue-200",
  開催済み: "bg-emerald-50 text-emerald-700 border-emerald-200",
  中止: "bg-rose-50 text-rose-700 border-rose-200",
  アーカイブ: "bg-slate-100 text-slate-500 border-slate-200",
};

export function progressColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-brand";
  if (pct >= 30) return "bg-amber-500";
  return "bg-slate-400";
}
