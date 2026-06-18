import { prisma } from "@/lib/prisma";
import { tasksToCsv } from "@/lib/csv";
import { serializeTask } from "@/lib/serialize";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const webinar = await prisma.webinar.findUnique({
    where: { id: params.id },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!webinar) {
    return new Response("not found", { status: 404 });
  }
  const csv = tasksToCsv(webinar.tasks.map((t) => serializeTask(t as never)));
  // Prepend BOM so Excel opens the UTF-8 file with correct Japanese encoding.
  const body = "﻿" + csv;

  // HTTP header values must be Latin-1, so the Japanese title can't go in
  // `filename`. Provide an ASCII fallback plus an RFC 5987 UTF-8 `filename*`.
  const fullName = `${webinar.webinarDate}_${webinar.title || "webinar"}.csv`;
  const asciiName = `webinar_${webinar.webinarDate}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fullName)}`,
    },
  });
}
