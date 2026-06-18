import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { serializeTask, serializeWebinar } from "@/lib/serialize";
import { computeStats } from "@/lib/stats";
import { diffDays, formatDisplay, isOverdue, todayISO } from "@/lib/dates";
import { PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { TASK_STATUS_DOT } from "@/lib/status";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

function pickFocusWebinar<T extends { webinarDate: string }>(webinars: T[]): T | null {
  if (webinars.length === 0) return null;
  const today = todayISO();
  const upcoming = webinars
    .filter((w) => diffDays(w.webinarDate, today) >= 0)
    .sort((a, b) => a.webinarDate.localeCompare(b.webinarDate));
  if (upcoming.length > 0) return upcoming[0];
  // otherwise the most recent past webinar
  return [...webinars].sort((a, b) => b.webinarDate.localeCompare(a.webinarDate))[0];
}

function TaskLine({ task }: { task: Task }) {
  return (
    <Link
      href={`/webinars/${task.webinarId}`}
      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 text-[13px]"
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${TASK_STATUS_DOT[task.status]}`} />
      <span className="truncate flex-1">{task.smallCategory || task.middleCategory}</span>
      <span className="text-[11px] text-slate-400 shrink-0">{task.assignee || "—"}</span>
      <span className="text-[11px] text-slate-500 shrink-0 w-16 text-right">
        {formatDisplay(task.dueDate)}
      </span>
    </Link>
  );
}

export default async function DashboardPage() {
  const raw = await prisma.webinar.findMany({ include: { tasks: true } });
  const webinars = raw.map((w) => ({
    ...serializeWebinar(w as never),
    tasks: w.tasks.map((t) => serializeTask(t as never)),
  }));

  const focus = pickFocusWebinar(webinars);
  const today = todayISO();

  if (!focus) {
    return (
      <>
        <PageHeader title="ダッシュボード" subtitle="直近ウェビナーの進捗" />
        <div className="p-6">
          <div className="card p-10 text-center text-slate-500">
            ウェビナーがまだありません。
            <div className="mt-3">
              <Link href="/webinars" className="btn-primary">
                ウェビナーを作成する
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const stats = computeStats(focus.tasks, today);
  const daysLeft = diffDays(focus.webinarDate, today);

  const overdueTasks = focus.tasks
    .filter((t) => isOverdue(t.dueDate, t.status, today))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const startToday = focus.tasks.filter(
    (t) => t.startDate === today && t.status !== "完了" && t.status !== "不要"
  );
  const dueWithinWeek = focus.tasks
    .filter((t) => {
      if (!t.dueDate || t.status === "完了" || t.status === "不要") return false;
      const d = diffDays(t.dueDate, today);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        subtitle="直近ウェビナーの進捗"
        actions={
          <Link href={`/webinars/${focus.id}`} className="btn-primary">
            詳細を開く
          </Link>
        }
      />
      <div className="p-6 space-y-6">
        {/* Focus webinar header */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-[12px] text-slate-500">直近のウェビナー</div>
              <Link
                href={`/webinars/${focus.id}`}
                className="text-[16px] font-bold text-slate-800 hover:text-brand line-clamp-2"
              >
                {focus.title}
              </Link>
              <div className="text-[13px] text-slate-600 mt-1">
                開催日：<b>{formatDisplay(focus.webinarDate)}</b>{" "}
                <span className="text-slate-400">({focus.webinarDate})</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-slate-500">開催まで</div>
              <div className="text-3xl font-bold text-brand">
                {daysLeft >= 0 ? `${daysLeft}日` : `${Math.abs(daysLeft)}日経過`}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[12px] mb-1">
              <span className="text-slate-500">全体進捗</span>
              <span className="font-semibold">
                {stats.progress}%（{stats.done}/{stats.total}）
              </span>
            </div>
            <ProgressBar pct={stats.progress} />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="未着手" value={stats.byStatus["未着手"]} />
          <StatCard label="着手中" value={stats.byStatus["着手中"]} accent="text-blue-600" />
          <StatCard label="完了" value={stats.byStatus["完了"]} accent="text-emerald-600" />
          <StatCard label="保留" value={stats.byStatus["保留"]} accent="text-amber-600" />
          <StatCard label="期限超過" value={stats.overdue} accent="text-rose-600" />
          <StatCard label="今日着手" value={stats.startToday} accent="text-brand" />
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-4">
            <h3 className="text-[13px] font-bold text-rose-600 mb-2">⚠️ 期限超過タスク（{overdueTasks.length}）</h3>
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {overdueTasks.length === 0 && <p className="text-[12px] text-slate-400 px-2 py-4">なし 🎉</p>}
              {overdueTasks.map((t) => (
                <TaskLine key={t.id} task={t} />
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-[13px] font-bold text-brand mb-2">▶️ 今日着手すべき（{startToday.length}）</h3>
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {startToday.length === 0 && <p className="text-[12px] text-slate-400 px-2 py-4">なし</p>}
              {startToday.map((t) => (
                <TaskLine key={t.id} task={t} />
              ))}
            </div>
          </div>
          <div className="card p-4">
            <h3 className="text-[13px] font-bold text-slate-700 mb-2">📅 1週間以内が期日（{dueWithinWeek.length}）</h3>
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {dueWithinWeek.length === 0 && <p className="text-[12px] text-slate-400 px-2 py-4">なし</p>}
              {dueWithinWeek.map((t) => (
                <TaskLine key={t.id} task={t} />
              ))}
            </div>
          </div>
        </div>

        {/* By assignee */}
        <div className="card p-4">
          <h3 className="text-[13px] font-bold text-slate-700 mb-3">担当者別の未完了タスク数</h3>
          <div className="flex flex-wrap gap-2">
            {stats.byAssignee.length === 0 && <p className="text-[12px] text-slate-400">未完了タスクなし</p>}
            {stats.byAssignee.map((a) => (
              <span
                key={a.assignee}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[12px]"
              >
                {a.assignee}
                <b className="text-slate-800">{a.open}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
