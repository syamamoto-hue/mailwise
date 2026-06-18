import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { replaceTemplate } from "@/lib/webinarService";

export async function GET() {
  const templates = await prisma.taskTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(templates);
}

// Create a single template row (appended to the end).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const last = await prisma.taskTemplate.findFirst({ orderBy: { sortOrder: "desc" } });
  const created = await prisma.taskTemplate.create({
    data: {
      largeCategory: body.largeCategory ?? "新規カテゴリ",
      middleCategory: body.middleCategory ?? "",
      smallCategory: body.smallCategory ?? "新しいタスク",
      company: body.company ?? null,
      assignee: body.assignee ?? null,
      defaultStatus: body.defaultStatus ?? "未着手",
      effortDays: body.effortDays ?? null,
      startOffsetDays: body.startOffsetDays ?? null,
      dueOffsetDays: body.dueOffsetDays ?? null,
      note: body.note ?? null,
      sortOrder: last ? last.sortOrder + 1 : 0,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

// Replace the whole master template with the provided rows.
export async function PUT(req: Request) {
  const body = await req.json();
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows 配列が必要です" }, { status: 400 });
  }
  await replaceTemplate(body.rows);
  const templates = await prisma.taskTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(templates);
}
