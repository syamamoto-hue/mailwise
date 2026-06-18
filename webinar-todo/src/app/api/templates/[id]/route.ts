import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FIELDS = [
  "largeCategory",
  "middleCategory",
  "smallCategory",
  "company",
  "assignee",
  "defaultStatus",
  "effortDays",
  "startOffsetDays",
  "dueOffsetDays",
  "note",
  "sortOrder",
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) data[f] = body[f];
  const updated = await prisma.taskTemplate.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.taskTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
