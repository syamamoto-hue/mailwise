import { prisma } from "./prisma";
import { dateFromOffset, materializeTaskDates } from "./dates";

/**
 * Re-materialize startDate/dueDate for every task of a webinar from its offsets.
 * Manually overridden tasks keep their absolute dates.
 */
export async function recalcWebinarTaskDates(webinarId: string): Promise<void> {
  const webinar = await prisma.webinar.findUnique({ where: { id: webinarId } });
  if (!webinar) return;
  const tasks = await prisma.task.findMany({ where: { webinarId } });
  await prisma.$transaction(
    tasks.map((t) => {
      const { startDate, dueDate } = materializeTaskDates(webinar.webinarDate, t);
      return prisma.task.update({
        where: { id: t.id },
        data: { startDate, dueDate },
      });
    })
  );
}

/** Create a new webinar whose tasks are generated from the master template. */
export async function createWebinarFromTemplate(input: {
  title: string;
  webinarDate: string;
  leadStartDate?: string | null;
  firstMaterialShareDate?: string | null;
  slideFixDate?: string | null;
}) {
  const templates = await prisma.taskTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  const webinar = await prisma.webinar.create({
    data: {
      title: input.title,
      webinarDate: input.webinarDate,
      leadStartDate: input.leadStartDate ?? null,
      firstMaterialShareDate: input.firstMaterialShareDate ?? null,
      slideFixDate: input.slideFixDate ?? null,
      status: "準備中",
      tasks: {
        create: templates.map((tpl) => ({
          parentTemplateTaskId: tpl.id,
          largeCategory: tpl.largeCategory,
          middleCategory: tpl.middleCategory,
          smallCategory: tpl.smallCategory,
          company: tpl.company,
          assignee: tpl.assignee,
          status: tpl.defaultStatus,
          effortDays: tpl.effortDays,
          startOffsetDays: tpl.startOffsetDays,
          dueOffsetDays: tpl.dueOffsetDays,
          startDate: dateFromOffset(input.webinarDate, tpl.startOffsetDays),
          dueDate: dateFromOffset(input.webinarDate, tpl.dueOffsetDays),
          note: tpl.note,
          sortOrder: tpl.sortOrder,
        })),
      },
    },
    include: { tasks: true },
  });
  return webinar;
}

/**
 * Duplicate an existing webinar with a new date/title. Offsets are copied and
 * dates are recomputed against the new webinar date (manual overrides are reset).
 */
export async function duplicateWebinar(input: {
  sourceId: string;
  title: string;
  webinarDate: string;
}) {
  const source = await prisma.webinar.findUnique({
    where: { id: input.sourceId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) throw new Error("複製元のウェビナーが見つかりません");

  const webinar = await prisma.webinar.create({
    data: {
      title: input.title,
      webinarDate: input.webinarDate,
      status: "準備中",
      tasks: {
        create: source.tasks.map((t) => ({
          parentTemplateTaskId: t.parentTemplateTaskId,
          largeCategory: t.largeCategory,
          middleCategory: t.middleCategory,
          smallCategory: t.smallCategory,
          company: t.company,
          assignee: t.assignee,
          // Fresh instance -> reset progress for the new month.
          status: "未着手",
          effortDays: t.effortDays,
          startOffsetDays: t.startOffsetDays,
          dueOffsetDays: t.dueOffsetDays,
          startDate: dateFromOffset(input.webinarDate, t.startOffsetDays),
          dueDate: dateFromOffset(input.webinarDate, t.dueOffsetDays),
          note: t.note,
          sortOrder: t.sortOrder,
          isManuallyOverridden: false,
        })),
      },
    },
    include: { tasks: true },
  });
  return webinar;
}

/** Replace the master template with the given task rows (offsets-based). */
export async function replaceTemplate(
  rows: {
    largeCategory: string;
    middleCategory: string;
    smallCategory: string;
    company?: string | null;
    assignee?: string | null;
    defaultStatus?: string;
    effortDays?: number | null;
    startOffsetDays?: number | null;
    dueOffsetDays?: number | null;
    note?: string | null;
    sortOrder: number;
  }[]
) {
  await prisma.taskTemplate.deleteMany();
  await prisma.taskTemplate.createMany({
    data: rows.map((r) => ({
      largeCategory: r.largeCategory,
      middleCategory: r.middleCategory,
      smallCategory: r.smallCategory,
      company: r.company ?? null,
      assignee: r.assignee ?? null,
      defaultStatus: r.defaultStatus ?? "未着手",
      effortDays: r.effortDays ?? null,
      startOffsetDays: r.startOffsetDays ?? null,
      dueOffsetDays: r.dueOffsetDays ?? null,
      note: r.note ?? null,
      sortOrder: r.sortOrder,
    })),
  });
}
