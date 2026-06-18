import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { serializeTask, serializeWebinar } from "@/lib/serialize";
import { computeStats } from "@/lib/stats";
import { diffDays, formatDisplay, todayISO } from "@/lib/dates";
import { PageHeader, ProgressBar } from "@/components/ui";
import { WEBINAR_STATUS_STYLE } from "@/lib/status";
import NewWebinarDialog from "@/components/NewWebinarDialog";
import type { WebinarStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WebinarsPage() {
  const raw = await prisma.webinar.findMany({
    orderBy: { webinarDate: "desc" },
    include: { tasks: true },
  });
  const today = todayISO();

  const rows = raw.map((w) => {
    const webinar = serializeWebinar(w as never);
    const stats = computeStats(w.tasks.map((t) => serializeTask(t as never)), today);
    return { webinar, stats, daysLeft: diffDays(webinar.webinarDate, today) };
  });

  const options = rows.map((r) => ({ id: r.webinar.id, title: r.webinar.title }));

  return (
    <>
      <PageHeader
        title="ウェビナー一覧"
        subtitle={`${rows.length} 件`}
        actions={<NewWebinarDialog existing={options} />}
      />
      <div className="p-6">
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-medium px-4 py-2.5">ウェビナー</th>
                <th className="text-left font-medium px-3 py-2.5 w-28">開催日</th>
                <th className="text-left font-medium px-3 py-2.5 w-20">ステータス</th>
                <th className="text-left font-medium px-3 py-2.5 w-44">進捗</th>
                <th className="text-center font-medium px-3 py-2.5 w-20">期限超過</th>
                <th className="text-center font-medium px-3 py-2.5 w-20">今日</th>
                <th className="text-left font-medium px-3 py-2.5 w-40">担当者(未完了)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-10">
                    ウェビナーがありません。右上から作成してください。
                  </td>
                </tr>
              )}
              {rows.map(({ webinar, stats, daysLeft }) => (
                <tr key={webinar.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/webinars/${webinar.id}`} className="font-medium text-slate-800 hover:text-brand line-clamp-2">
                      {webinar.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div>{formatDisplay(webinar.webinarDate)}</div>
                    <div className="text-[11px] text-slate-400">
                      {daysLeft >= 0 ? `あと${daysLeft}日` : `${Math.abs(daysLeft)}日前`}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${
                        WEBINAR_STATUS_STYLE[webinar.status as WebinarStatus]
                      }`}
                    >
                      {webinar.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={stats.progress} className="flex-1" />
                      <span className="text-[11px] text-slate-500 w-16 text-right">
                        {stats.done}/{stats.total} ({stats.progress}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {stats.overdue > 0 ? (
                      <span className="font-bold text-rose-600">{stats.overdue}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {stats.startToday + stats.dueToday > 0 ? (
                      <span className="font-bold text-brand">{stats.startToday + stats.dueToday}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {stats.byAssignee.slice(0, 4).map((a) => (
                        <span key={a.assignee} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
                          {a.assignee} {a.open}
                        </span>
                      ))}
                      {stats.byAssignee.length === 0 && <span className="text-[11px] text-slate-300">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
