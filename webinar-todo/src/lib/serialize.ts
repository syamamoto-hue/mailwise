import type { Task, TaskStatus, Webinar, WebinarStatus, TaskTemplate } from "./types";

// Prisma returns Date objects for createdAt/updatedAt; convert to plain ISO
// strings so the data can cross the server/client boundary and match our types.

type AnyRow = Record<string, unknown> & { createdAt: Date; updatedAt: Date };

export function serializeWebinar(w: AnyRow): Webinar {
  return {
    ...(w as unknown as Webinar),
    status: w.status as WebinarStatus,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function serializeTask(t: AnyRow): Task {
  return {
    ...(t as unknown as Task),
    status: t.status as TaskStatus,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeTemplate(t: AnyRow): TaskTemplate {
  return {
    ...(t as unknown as TaskTemplate),
    defaultStatus: t.defaultStatus as TaskStatus,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
