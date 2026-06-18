import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeTask, serializeWebinar } from "@/lib/serialize";
import WebinarDetailClient from "@/components/WebinarDetailClient";

export const dynamic = "force-dynamic";

export default async function WebinarDetailPage({ params }: { params: { id: string } }) {
  const w = await prisma.webinar.findUnique({
    where: { id: params.id },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!w) notFound();

  const webinar = serializeWebinar(w as never);
  const tasks = w.tasks.map((t) => serializeTask(t as never));

  return <WebinarDetailClient initialWebinar={webinar} initialTasks={tasks} />;
}
