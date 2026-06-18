"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toISO, isOverdue, todayISO } from "@/lib/dates";

export type CalTask = {
  id: string;
  webinarId: string;
  label: string;
  assignee: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
};

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export default function CalendarClient({ tasks }: { tasks: CalTask[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = todayISO();

  const { starts, dues } = useMemo(() => {
    const s = new Map<string, CalTask[]>();
    const d = new Map<string, CalTask[]>();
    const push = (m: Map<string, CalTask[]>, key: string, t: CalTask) => {
      const arr = m.get(key);
      if (arr) arr.push(t);
      else m.set(key, [t]);
    };
    for (const t of tasks) {
      if (t.startDate) push(s, t.startDate, t);
      if (t.dueDate) push(d, t.dueDate, t);
    }
    return { starts: s, dues: d };
  }, [tasks]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor));
    const gridEnd = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <button className="btn" onClick={() => setCursor((c) => addMonths(c, -1))}>
          ← 前月
        </button>
        <h2 className="text-[15px] font-bold">{format(cursor, "yyyy年 M月")}</h2>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setCursor(startOfMonth(new Date()))}>
            今月
          </button>
          <button className="btn" onClick={() => setCursor((c) => addMonths(c, 1))}>
            次月 →
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand" /> 開始（着手日）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> 期限（期日）
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" /> 期限超過
        </span>
      </div>

      <div className="grid grid-cols-7 text-[11px] text-slate-400 border-b border-slate-200 pb-1">
        {WEEK.map((w, i) => (
          <div key={w} className={`px-2 ${i === 0 ? "text-rose-400" : i === 6 ? "text-blue-400" : ""}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = toISO(day);
          const inMonth = isSameMonth(day, cursor);
          const isToday = iso === today;
          const dayStarts = starts.get(iso) ?? [];
          const dayDues = dues.get(iso) ?? [];
          return (
            <div
              key={iso}
              className={`min-h-[104px] border-b border-r border-slate-100 p-1.5 ${
                inMonth ? "bg-white" : "bg-slate-50/50"
              }`}
            >
              <div
                className={`text-[11px] mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full ${
                  isToday ? "bg-brand text-white font-bold" : inMonth ? "text-slate-600" : "text-slate-300"
                }`}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayStarts.slice(0, 3).map((t) => (
                  <CalChip key={"s" + t.id} t={t} kind="start" today={today} />
                ))}
                {dayDues.slice(0, 3).map((t) => (
                  <CalChip key={"d" + t.id} t={t} kind="due" today={today} />
                ))}
                {dayStarts.length + dayDues.length > 6 && (
                  <div className="text-[10px] text-slate-400">＋{dayStarts.length + dayDues.length - 6}件</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalChip({ t, kind, today }: { t: CalTask; kind: "start" | "due"; today: string }) {
  const done = t.status === "完了" || t.status === "不要";
  const overdue = kind === "due" && isOverdue(t.dueDate, t.status, today);
  const base =
    kind === "start" ? "border-brand/40 bg-brand/5 text-brand" : "border-violet-300 bg-violet-50 text-violet-700";
  const cls = overdue
    ? "border-rose-300 bg-rose-50 text-rose-600 font-semibold"
    : done
    ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
    : base;
  return (
    <Link
      href={`/webinars/${t.webinarId}`}
      className={`block truncate rounded border px-1 py-0.5 text-[10px] leading-tight ${cls}`}
      title={`${kind === "start" ? "開始" : "期限"}: ${t.label}${t.assignee ? " / " + t.assignee : ""}`}
    >
      {kind === "start" ? "▶" : "⏰"} {t.label}
    </Link>
  );
}
