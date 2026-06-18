import { TASK_STATUSES, type Task, type TaskStatus, type WebinarStats } from "./types";
import { isOverdue, todayISO } from "./dates";

/** Compute aggregate progress / overdue / per-assignee stats for a set of tasks. */
export function computeStats(tasks: Task[], todayIso = todayISO()): WebinarStats {
  const byStatus = Object.fromEntries(
    TASK_STATUSES.map((s) => [s, 0])
  ) as Record<TaskStatus, number>;

  let done = 0;
  let overdue = 0;
  let dueToday = 0;
  let startToday = 0;
  const assigneeOpen = new Map<string, number>();

  // Tasks marked 不要 are excluded from the "total" denominator for progress.
  const counted = tasks.filter((t) => t.status !== "不要");

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;

    if (t.status === "完了") done++;
    if (isOverdue(t.dueDate, t.status, todayIso)) overdue++;
    if (t.dueDate === todayIso && t.status !== "完了" && t.status !== "不要") dueToday++;
    if (t.startDate === todayIso && t.status !== "完了" && t.status !== "不要") startToday++;

    const open = t.status !== "完了" && t.status !== "不要";
    if (open) {
      const key = t.assignee?.trim() || "未割当";
      assigneeOpen.set(key, (assigneeOpen.get(key) ?? 0) + 1);
    }
  }

  const total = counted.length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  const byAssignee = [...assigneeOpen.entries()]
    .map(([assignee, open]) => ({ assignee, open }))
    .sort((a, b) => b.open - a.open);

  return { total, done, progress, overdue, dueToday, startToday, byStatus, byAssignee };
}
