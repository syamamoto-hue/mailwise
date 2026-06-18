import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Duplicate a task within the same webinar (inserted right after the original).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const src = await prisma.task.findUnique({ where: { id: params.id } });
  if (!src) return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });

  // Shift sortOrder of following tasks to make room.
  await prisma.task.updateMany({
    where: { webinarId: src.webinarId, sortOrder: { gt: src.sortOrder } },
    data: { sortOrder: { increment: 1 } },
  });

  const copy = await prisma.task.create({
    data: {
      webinarId: src.webinarId,
      parentTemplateTaskId: src.parentTemplateTaskId,
      largeCategory: src.largeCategory,
      middleCategory: src.middleCategory,
      smallCategory: src.smallCategory + "（複製）",
      company: src.company,
      assignee: src.assignee,
      status: "未着手",
      effortDays: src.effortDays,
      startOffsetDays: src.startOffsetDays,
      dueOffsetDays: src.dueOffsetDays,
      startDate: src.startDate,
      dueDate: src.dueDate,
      note: src.note,
      sortOrder: src.sortOrder + 1,
      isManuallyOverridden: src.isManuallyOverridden,
    },
  });
  return NextResponse.json(copy, { status: 201 });
}
