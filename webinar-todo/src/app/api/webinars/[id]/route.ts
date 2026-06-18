import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcWebinarTaskDates } from "@/lib/webinarService";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!webinar) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return NextResponse.json(webinar);
}

const WEBINAR_FIELDS = [
  "title",
  "webinarDate",
  "leadStartDate",
  "firstMaterialShareDate",
  "slideFixDate",
  "status",
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const existing = await prisma.webinar.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const f of WEBINAR_FIELDS) {
    if (f in body) data[f] = body[f];
  }

  const updated = await prisma.webinar.update({ where: { id: params.id }, data });

  // If the webinar date changed, re-materialize task dates from their offsets.
  if ("webinarDate" in data && data.webinarDate !== existing.webinarDate) {
    await recalcWebinarTaskDates(params.id);
  }

  const result = await prisma.webinar.findUnique({
    where: { id: params.id },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(result ?? updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.webinar.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
