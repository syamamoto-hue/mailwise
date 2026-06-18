"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Task, TaskStatus, Webinar } from "@/lib/types";
import { TASK_STATUSES } from "@/lib/types";
import { computeStats } from "@/lib/stats";
import { TASK_STATUS_STYLE, WEBINAR_STATUS_STYLE } from "@/lib/status";
import { diffDays, formatDisplay, isOverdue, todayISO } from "@/lib/dates";
import { PageHeader, ProgressBar } from "@/components/ui";

const WEBINAR_STATUSES = ["準備中", "開催済み", "中止", "アーカイブ"] as const;

type ViewKey =
  | "all"
  | "large"
  | "assignee"
  | "status"
  | "due"
  | "today"
  | "overdue";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "all", label: "全タスク" },
  { key: "large", label: "大カテゴリ別" },
  { key: "assignee", label: "担当者別" },
  { key: "status", label: "ステータス別" },
  { key: "due", label: "期限順" },
  { key: "today", label: "今日やる" },
  { key: "overdue", label: "期限超過" },
];

export default function WebinarDetailClient({
  initialWebinar,
  initialTasks,
}: {
  initialWebinar: Webinar;
  initialTasks: Task[];
}) {
  const router = useRouter();
  const today = todayISO();
  const [webinar, setWebinar] = useState<Webinar>(initialWebinar);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<ViewKey>("all");
  const [pendingDate, setPendingDate] = useState<{
    taskId: string;
    field: "startDate" | "dueDate";
    value: string;
  } | null>(null);

  const stats = useMemo(() => computeStats(tasks, today), [tasks, today]);
  const daysLeft = diffDays(webinar.webinarDate, today);

  // ----- mutation helpers -----
  async function reload() {
    const res = await fetch(`/api/webinars/${webinar.id}`);
    if (res.ok) {
      const data = await res.json();
      setWebinar(data);
      setTasks(data.tasks);
    }
  }

  function mergeTask(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function patchTask(id: string, body: Record<string, unknown>) {
    // optimistic
    mergeTask(id, body as Partial<Task>);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      mergeTask(id, data);
    } else {
      reload();
    }
  }

  async function patchWebinar(body: Record<string, unknown>) {
    setWebinar((w) => ({ ...w, ...(body as Partial<Webinar>) }));
    const res = await fetch(`/api/webinars/${webinar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setWebinar(data);
      if (data.tasks) setTasks(data.tasks);
    }
  }

  async function addTask() {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webinarId: webinar.id,
        largeCategory: "新規カテゴリ",
        smallCategory: "新しいタスク",
      }),
    });
    if (res.ok) reload();
  }

  async function duplicateTask(id: string) {
    const res = await fetch(`/api/tasks/${id}/duplicate`, { method: "POST" });
    if (res.ok) reload();
  }

  async function deleteTask(id: string) {
    if (!confirm("このタスクを削除しますか？")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function move(id: string, dir: -1 | 1) {
    const ordered = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = ordered.findIndex((t) => t.id === id);
    const swapWith = ordered[idx + dir];
    if (!swapWith) return;
    const a = ordered[idx];
    await Promise.all([
      fetch(`/api/tasks/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapWith.sortOrder }),
      }),
      fetch(`/api/tasks/${swapWith.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    reload();
  }

  async function deleteWebinar() {
    if (!confirm("このウェビナーを削除しますか？タスクも全て削除されます。")) return;
    const res = await fetch(`/api/webinars/${webinar.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/webinars");
      router.refresh();
    }
  }

  function onDateInput(taskId: string, field: "startDate" | "dueDate", value: string) {
    setPendingDate({ taskId, field, value });
  }

  async function applyDateChange(mode: "this" | "template") {
    if (!pendingDate) return;
    const { taskId, field, value } = pendingDate;
    setPendingDate(null);
    await patchTask(taskId, { [field]: value || null, dateChangeMode: mode });
  }

  // ----- view computation -----
  const groups = useMemo(() => buildGroups(tasks, view, today), [tasks, view, today]);

  return (
    <>
      <PageHeader
        title={webinar.title}
        subtitle={`開催 ${formatDisplay(webinar.webinarDate)}・${
          daysLeft >= 0 ? `あと${daysLeft}日` : `${Math.abs(daysLeft)}日経過`
        }`}
        actions={
          <>
            <Link href="/webinars" className="btn">
              ← 一覧
            </Link>
            <a className="btn" href={`/api/webinars/${webinar.id}/export`}>
              CSV書出
            </a>
            <button className="btn text-rose-600 border-rose-200" onClick={deleteWebinar}>
              削除
            </button>
          </>
        }
      />

      <div className="p-6 space-y-5">
        {/* Webinar meta */}
        <div className="card p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Field label="タイトル" className="md:col-span-2">
              <input
                className="field"
                defaultValue={webinar.title}
                onBlur={(e) => e.target.value !== webinar.title && patchWebinar({ title: e.target.value })}
              />
            </Field>
            <Field label="開催日（変更で自動再計算）">
              <input
                type="date"
                className="field"
                value={webinar.webinarDate}
                onChange={(e) => patchWebinar({ webinarDate: e.target.value })}
              />
            </Field>
            <Field label="ステータス">
              <select
                className={`field ${WEBINAR_STATUS_STYLE[webinar.status]}`}
                value={webinar.status}
                onChange={(e) => patchWebinar({ status: e.target.value })}
              >
                {WEBINAR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-col justify-end">
              <div className="text-[12px] text-slate-500 mb-1">進捗</div>
              <div className="flex items-center gap-2">
                <ProgressBar pct={stats.progress} className="flex-1" />
                <span className="text-[12px] font-semibold w-20 text-right">
                  {stats.done}/{stats.total} ({stats.progress}%)
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <Field label="集客開始日">
              <input
                type="date"
                className="field"
                value={webinar.leadStartDate ?? ""}
                onChange={(e) => patchWebinar({ leadStartDate: e.target.value || null })}
              />
            </Field>
            <Field label="一次資料共有日">
              <input
                type="date"
                className="field"
                value={webinar.firstMaterialShareDate ?? ""}
                onChange={(e) => patchWebinar({ firstMaterialShareDate: e.target.value || null })}
              />
            </Field>
            <Field label="ご講演資料FIX日">
              <input
                type="date"
                className="field"
                value={webinar.slideFixDate ?? ""}
                onChange={(e) => patchWebinar({ slideFixDate: e.target.value || null })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 text-[12px]">
            <Chip label="未着手" n={stats.byStatus["未着手"]} />
            <Chip label="着手中" n={stats.byStatus["着手中"]} cls="text-blue-600" />
            <Chip label="完了" n={stats.byStatus["完了"]} cls="text-emerald-600" />
            <Chip label="保留" n={stats.byStatus["保留"]} cls="text-amber-600" />
            <Chip label="不要" n={stats.byStatus["不要"]} cls="text-slate-400" />
            <Chip label="期限超過" n={stats.overdue} cls="text-rose-600" />
          </div>
        </div>

        {/* View toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium border ${
                  view === v.key
                    ? "bg-brand text-white border-brand"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={addTask}>
            ＋ タスク追加
          </button>
        </div>

        {/* Task table */}
        <div className="card overflow-x-auto">
          <table className="w-full text-[12.5px] min-w-[1180px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] sticky top-0">
                <th className="text-left font-medium px-2 py-2 w-8"></th>
                <th className="text-left font-medium px-2 py-2 w-32">大カテゴリ</th>
                <th className="text-left font-medium px-2 py-2 w-28">中カテゴリ</th>
                <th className="text-left font-medium px-2 py-2 w-56">小カテゴリ</th>
                <th className="text-left font-medium px-2 py-2 w-28">会社</th>
                <th className="text-left font-medium px-2 py-2 w-24">担当者</th>
                <th className="text-left font-medium px-2 py-2 w-24">ステータス</th>
                <th className="text-left font-medium px-2 py-2 w-14">工数</th>
                <th className="text-left font-medium px-2 py-2 w-32">着手日</th>
                <th className="text-left font-medium px-2 py-2 w-32">期日</th>
                <th className="text-left font-medium px-2 py-2 w-32">完了日</th>
                <th className="text-left font-medium px-2 py-2 w-48">備考</th>
                <th className="text-left font-medium px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows
                  key={g.key}
                  group={g}
                  view={view}
                  today={today}
                  onPatch={patchTask}
                  onDateInput={onDateInput}
                  onDuplicate={duplicateTask}
                  onDelete={deleteTask}
                  onMove={move}
                />
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center text-slate-400 py-10">
                    タスクがありません。「＋ タスク追加」または CSV取込 から追加してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Date change scope modal */}
      {pendingDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-[15px] font-bold mb-2">日付の変更範囲</h3>
            <p className="text-[13px] text-slate-600 mb-4">
              {pendingDate.field === "startDate" ? "着手日" : "期日"}を{" "}
              <b>{pendingDate.value || "（クリア）"}</b> に変更します。反映範囲を選んでください。
            </p>
            <div className="space-y-2">
              <button
                className="w-full text-left rounded-md border border-slate-300 px-4 py-3 hover:bg-slate-50"
                onClick={() => applyDateChange("this")}
              >
                <div className="font-semibold text-[13px]">このウェビナーだけ変更</div>
                <div className="text-[12px] text-slate-500">手動変更として記録します（テンプレートは変わりません）。</div>
              </button>
              <button
                className="w-full text-left rounded-md border border-brand bg-brand/5 px-4 py-3 hover:bg-brand/10"
                onClick={() => applyDateChange("template")}
              >
                <div className="font-semibold text-[13px] text-brand">今後のテンプレートにも反映</div>
                <div className="text-[12px] text-slate-500">開催日から逆算してオフセット日数を更新します。</div>
              </button>
            </div>
            <div className="mt-4 text-right">
              <button className="btn" onClick={() => setPendingDate(null)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- helpers / subcomponents ----------

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Chip({ label, n, cls = "" }: { label: string; n: number; cls?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
      <span className="text-slate-500">{label}</span>
      <b className={cls || "text-slate-700"}>{n}</b>
    </span>
  );
}

type Group = { key: string; label: string | null; tasks: Task[] };

function buildGroups(tasks: Task[], view: ViewKey, today: string): Group[] {
  const byOrder = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  if (view === "due") {
    const sorted = [...tasks].sort((a, b) =>
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
    );
    return [{ key: "due", label: null, tasks: sorted }];
  }
  if (view === "today") {
    const t = byOrder.filter(
      (x) =>
        (x.startDate === today || x.dueDate === today) &&
        x.status !== "完了" &&
        x.status !== "不要"
    );
    return [{ key: "today", label: null, tasks: t }];
  }
  if (view === "overdue") {
    const t = byOrder
      .filter((x) => isOverdue(x.dueDate, x.status, today))
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    return [{ key: "overdue", label: null, tasks: t }];
  }
  if (view === "all") {
    return [{ key: "all", label: null, tasks: byOrder }];
  }

  // grouped views
  const keyOf = (t: Task) =>
    view === "large"
      ? t.largeCategory || "（未分類）"
      : view === "assignee"
      ? t.assignee || "（未割当）"
      : t.status;

  const order =
    view === "status" ? [...TASK_STATUSES] : undefined;

  const map = new Map<string, Task[]>();
  for (const t of byOrder) {
    const k = keyOf(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  let keys = [...map.keys()];
  if (order) keys = order.filter((k) => map.has(k));
  return keys.map((k) => ({ key: k, label: k, tasks: map.get(k)! }));
}

function GroupRows({
  group,
  view,
  today,
  onPatch,
  onDateInput,
  onDuplicate,
  onDelete,
  onMove,
}: {
  group: Group;
  view: ViewKey;
  today: string;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onDateInput: (id: string, field: "startDate" | "dueDate", value: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <>
      {group.label && (
        <tr className="bg-slate-100/70">
          <td colSpan={13} className="px-3 py-1.5 text-[12px] font-bold text-slate-600">
            {group.label}{" "}
            <span className="font-normal text-slate-400">（{group.tasks.length}）</span>
          </td>
        </tr>
      )}
      {group.tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          allowMove={view === "all"}
          today={today}
          onPatch={onPatch}
          onDateInput={onDateInput}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </>
  );
}

function TaskRow({
  task,
  allowMove,
  today,
  onPatch,
  onDateInput,
  onDuplicate,
  onDelete,
  onMove,
}: {
  task: Task;
  allowMove: boolean;
  today: string;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onDateInput: (id: string, field: "startDate" | "dueDate", value: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const overdue = isOverdue(task.dueDate, task.status, today);
  const dim = task.status === "完了" || task.status === "不要";

  const textCell = (field: keyof Task) => (
    <input
      className="cell-input"
      defaultValue={(task[field] as string) ?? ""}
      onBlur={(e) => {
        const v = e.target.value;
        if (v !== ((task[field] as string) ?? "")) onPatch(task.id, { [field]: v || null });
      }}
    />
  );

  return (
    <tr className={`border-t border-slate-100 hover:bg-slate-50/60 ${dim ? "opacity-60" : ""}`}>
      <td className="px-1 py-1 align-top">
        {allowMove ? (
          <div className="flex flex-col">
            <button className="text-slate-300 hover:text-slate-600 leading-none" onClick={() => onMove(task.id, -1)} title="上へ">
              ▲
            </button>
            <button className="text-slate-300 hover:text-slate-600 leading-none" onClick={() => onMove(task.id, 1)} title="下へ">
              ▼
            </button>
          </div>
        ) : (
          <span className="text-slate-200 text-[10px]">●</span>
        )}
      </td>
      <td className="px-1 py-1">{textCell("largeCategory")}</td>
      <td className="px-1 py-1">{textCell("middleCategory")}</td>
      <td className="px-1 py-1">{textCell("smallCategory")}</td>
      <td className="px-1 py-1">{textCell("company")}</td>
      <td className="px-1 py-1">{textCell("assignee")}</td>
      <td className="px-1 py-1">
        <select
          value={task.status}
          onChange={(e) => onPatch(task.id, { status: e.target.value })}
          className={`w-full rounded border px-1.5 py-1 text-[12px] ${TASK_STATUS_STYLE[task.status]}`}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1">
        <input
          type="number"
          step="0.5"
          className="cell-input w-12"
          defaultValue={task.effortDays ?? ""}
          onBlur={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            if (v !== (task.effortDays ?? null)) onPatch(task.id, { effortDays: v });
          }}
        />
      </td>
      <td className="px-1 py-1">
        <input
          type="date"
          className="cell-input"
          value={task.startDate ?? ""}
          onChange={(e) => onDateInput(task.id, "startDate", e.target.value)}
          title={task.isManuallyOverridden ? "手動変更あり" : ""}
        />
      </td>
      <td className="px-1 py-1">
        <input
          type="date"
          className={`cell-input ${overdue ? "text-rose-600 font-semibold bg-rose-50" : ""}`}
          value={task.dueDate ?? ""}
          onChange={(e) => onDateInput(task.id, "dueDate", e.target.value)}
        />
      </td>
      <td className="px-1 py-1">
        <input
          type="date"
          className="cell-input"
          value={task.completedDate ?? ""}
          onChange={(e) => onPatch(task.id, { completedDate: e.target.value || null })}
        />
      </td>
      <td className="px-1 py-1">{textCell("note")}</td>
      <td className="px-1 py-1 whitespace-nowrap">
        <button className="btn-ghost" onClick={() => onDuplicate(task.id)} title="複製">
          ⧉
        </button>
        <button className="btn-ghost text-rose-500" onClick={() => onDelete(task.id)} title="削除">
          🗑
        </button>
      </td>
    </tr>
  );
}
