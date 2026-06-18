import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import CalendarClient, { type CalTask } from "@/components/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const tasks = await prisma.task.findMany({
    where: { OR: [{ startDate: { not: null } }, { dueDate: { not: null } }] },
    select: {
      id: true,
      webinarId: true,
      smallCategory: true,
      middleCategory: true,
      assignee: true,
      status: true,
      startDate: true,
      dueDate: true,
    },
  });

  const calTasks: CalTask[] = tasks.map((t) => ({
    id: t.id,
    webinarId: t.webinarId,
    label: t.smallCategory || t.middleCategory || "(無題)",
    assignee: t.assignee,
    status: t.status,
    startDate: t.startDate,
    dueDate: t.dueDate,
  }));

  return (
    <>
      <PageHeader title="カレンダー" subtitle="着手日（開始）と期日（期限）を月表示" />
      <div className="p-6">
        <CalendarClient tasks={calTasks} />
      </div>
    </>
  );
}
