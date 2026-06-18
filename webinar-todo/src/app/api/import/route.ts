import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWebinarCsv } from "@/lib/csv";
import { replaceTemplate } from "@/lib/webinarService";

// Import a CSV. mode: "new" | "overwrite" | "template"
export async function POST(req: Request) {
  const body = await req.json();
  const csv: string = body.csv ?? "";
  const mode: string = body.mode ?? "new";
  const year: number = body.year ?? new Date().getFullYear();

  if (!csv.trim()) {
    return NextResponse.json({ error: "CSV が空です" }, { status: 400 });
  }

  const parsed = parseWebinarCsv(csv, year);

  try {
    if (mode === "template") {
      await replaceTemplate(
        parsed.tasks.map((t) => ({
          largeCategory: t.largeCategory,
          middleCategory: t.middleCategory,
          smallCategory: t.smallCategory,
          company: t.company,
          assignee: t.assignee,
          defaultStatus: "未着手",
          effortDays: t.effortDays,
          startOffsetDays: t.startOffsetDays,
          dueOffsetDays: t.dueOffsetDays,
          note: t.note,
          sortOrder: t.sortOrder,
        }))
      );
      return NextResponse.json({
        mode,
        templateCount: parsed.tasks.length,
        warnings: parsed.warnings,
      });
    }

    const taskData = parsed.tasks.map((t) => ({
      largeCategory: t.largeCategory,
      middleCategory: t.middleCategory,
      smallCategory: t.smallCategory,
      company: t.company,
      assignee: t.assignee,
      status: t.status,
      effortDays: t.effortDays,
      startOffsetDays: t.startOffsetDays,
      dueOffsetDays: t.dueOffsetDays,
      startDate: t.startDate,
      dueDate: t.dueDate,
      completedDate: t.status === "完了" ? t.dueDate : null,
      note: t.note,
      sortOrder: t.sortOrder,
    }));

    if (mode === "overwrite") {
      if (!body.webinarId) {
        return NextResponse.json({ error: "上書き先の webinarId が必要です" }, { status: 400 });
      }
      await prisma.task.deleteMany({ where: { webinarId: body.webinarId } });
      const webinar = await prisma.webinar.update({
        where: { id: body.webinarId },
        data: {
          title: parsed.title || undefined,
          webinarDate: parsed.webinarDate || undefined,
          leadStartDate: parsed.leadStartDate,
          firstMaterialShareDate: parsed.firstMaterialShareDate,
          slideFixDate: parsed.slideFixDate,
          tasks: { create: taskData },
        },
        include: { tasks: true },
      });
      return NextResponse.json({ mode, webinarId: webinar.id, taskCount: taskData.length, warnings: parsed.warnings });
    }

    // new
    const webinar = await prisma.webinar.create({
      data: {
        title: parsed.title || "無題のウェビナー",
        webinarDate: parsed.webinarDate || new Date().toISOString().slice(0, 10),
        leadStartDate: parsed.leadStartDate,
        firstMaterialShareDate: parsed.firstMaterialShareDate,
        slideFixDate: parsed.slideFixDate,
        status: "準備中",
        tasks: { create: taskData },
      },
      include: { tasks: true },
    });
    return NextResponse.json({
      mode,
      webinarId: webinar.id,
      taskCount: taskData.length,
      title: webinar.title,
      webinarDate: webinar.webinarDate,
      warnings: parsed.warnings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "インポートに失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
