import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { offsetFromDate, todayISO } from "@/lib/dates";

const PLAIN_FIELDS = [
  "largeCategory",
  "middleCategory",
  "smallCategory",
  "company",
  "assignee",
  "effortDays",
  "note",
  "sortOrder",
  "completedDate",
] as const;

/**
 * Update a task. Special handling:
 *  - status -> auto-fills completedDate when set to 完了 (if not already set).
 *  - startDate / dueDate changes use `dateChangeMode`:
 *      "this"     : applies only to this webinar (isManuallyOverridden = true).
 *      "template" : recomputes offsets and pushes them to the linked template.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
  const webinar = await prisma.webinar.findUnique({ where: { id: task.webinarId } });
  if (!webinar) return NextResponse.json({ error: "ウェビナーが見つかりません" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const f of PLAIN_FIELDS) {
    if (f in body) data[f] = body[f];
  }

  // Status + completedDate handling.
  if ("status" in body) {
    data.status = body.status;
    if (body.status === "完了" && !("completedDate" in body) && !task.completedDate) {
      data.completedDate = todayISO();
    }
  }

  // Date changes.
  const startChanged = "startDate" in body;
  const dueChanged = "dueDate" in body;
  if (startChanged || dueChanged) {
    const newStart = startChanged ? body.startDate : task.startDate;
    const newDue = dueChanged ? body.dueDate : task.dueDate;
    data.startDate = newStart;
    data.dueDate = newDue;

    const mode: "this" | "template" = body.dateChangeMode === "template" ? "template" : "this";
    const newStartOffset = offsetFromDate(webinar.webinarDate, newStart);
    const newDueOffset = offsetFromDate(webinar.webinarDate, newDue);

    if (mode === "template") {
      // Offsets become the new source of truth; clear the manual flag.
      data.startOffsetDays = newStartOffset;
      data.dueOffsetDays = newDueOffset;
      data.isManuallyOverridden = false;
      if (task.parentTemplateTaskId) {
        await prisma.taskTemplate
          .update({
            where: { id: task.parentTemplateTaskId },
            data: { startOffsetDays: newStartOffset, dueOffsetDays: newDueOffset },
          })
          .catch(() => {
            /* template may have been deleted; ignore */
          });
      }
    } else {
      // This webinar only.
      data.isManuallyOverridden = true;
    }
  }

  const updated = await prisma.task.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
