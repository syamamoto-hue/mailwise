import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateFromOffset, offsetFromDate } from "@/lib/dates";

// Create a new task inside a webinar.
export async function POST(req: Request) {
  const body = await req.json();
  if (!body.webinarId) {
    return NextResponse.json({ error: "webinarId は必須です" }, { status: 400 });
  }
  const webinar = await prisma.webinar.findUnique({ where: { id: body.webinarId } });
  if (!webinar) return NextResponse.json({ error: "ウェビナーが見つかりません" }, { status: 404 });

  // Determine next sortOrder (append to end).
  const last = await prisma.task.findFirst({
    where: { webinarId: body.webinarId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = body.sortOrder ?? (last ? last.sortOrder + 1 : 0);

  // Accept either explicit dates or offsets; keep them consistent.
  let startOffsetDays = body.startOffsetDays ?? null;
  let dueOffsetDays = body.dueOffsetDays ?? null;
  let startDate = body.startDate ?? null;
  let dueDate = body.dueDate ?? null;

  if (startDate && startOffsetDays === null) startOffsetDays = offsetFromDate(webinar.webinarDate, startDate);
  if (dueDate && dueOffsetDays === null) dueOffsetDays = offsetFromDate(webinar.webinarDate, dueDate);
  if (!startDate && startOffsetDays !== null) startDate = dateFromOffset(webinar.webinarDate, startOffsetDays);
  if (!dueDate && dueOffsetDays !== null) dueDate = dateFromOffset(webinar.webinarDate, dueOffsetDays);

  const task = await prisma.task.create({
    data: {
      webinarId: body.webinarId,
      largeCategory: body.largeCategory ?? "",
      middleCategory: body.middleCategory ?? "",
      smallCategory: body.smallCategory ?? "",
      company: body.company ?? null,
      assignee: body.assignee ?? null,
      status: body.status ?? "未着手",
      effortDays: body.effortDays ?? null,
      startOffsetDays,
      dueOffsetDays,
      startDate,
      dueDate,
      note: body.note ?? null,
      sortOrder,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
