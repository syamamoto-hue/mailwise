import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createWebinarFromTemplate,
  duplicateWebinar,
} from "@/lib/webinarService";

export async function GET() {
  const webinars = await prisma.webinar.findMany({
    orderBy: { webinarDate: "desc" },
    include: { tasks: true },
  });
  return NextResponse.json(webinars);
}

// Create a webinar. mode: "blank" | "template" | "duplicate"
export async function POST(req: Request) {
  const body = await req.json();
  const mode: string = body.mode ?? "blank";

  try {
    if (mode === "template") {
      if (!body.title || !body.webinarDate) {
        return NextResponse.json({ error: "タイトルと開催日は必須です" }, { status: 400 });
      }
      const w = await createWebinarFromTemplate({
        title: body.title,
        webinarDate: body.webinarDate,
        leadStartDate: body.leadStartDate ?? null,
        firstMaterialShareDate: body.firstMaterialShareDate ?? null,
        slideFixDate: body.slideFixDate ?? null,
      });
      return NextResponse.json(w, { status: 201 });
    }

    if (mode === "duplicate") {
      if (!body.sourceId || !body.title || !body.webinarDate) {
        return NextResponse.json(
          { error: "複製元・タイトル・開催日は必須です" },
          { status: 400 }
        );
      }
      const w = await duplicateWebinar({
        sourceId: body.sourceId,
        title: body.title,
        webinarDate: body.webinarDate,
      });
      return NextResponse.json(w, { status: 201 });
    }

    // blank
    if (!body.title || !body.webinarDate) {
      return NextResponse.json({ error: "タイトルと開催日は必須です" }, { status: 400 });
    }
    const w = await prisma.webinar.create({
      data: {
        title: body.title,
        webinarDate: body.webinarDate,
        leadStartDate: body.leadStartDate ?? null,
        firstMaterialShareDate: body.firstMaterialShareDate ?? null,
        slideFixDate: body.slideFixDate ?? null,
        status: "準備中",
      },
    });
    return NextResponse.json(w, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
