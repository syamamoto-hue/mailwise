// Shared domain types. These mirror the Prisma models but are framework-agnostic
// so they can be shared between server and client code.

export const WEBINAR_STATUSES = ["準備中", "開催済み", "中止", "アーカイブ"] as const;
export type WebinarStatus = (typeof WEBINAR_STATUSES)[number];

export const TASK_STATUSES = ["未着手", "着手中", "完了", "保留", "不要"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Webinar = {
  id: string;
  title: string;
  webinarDate: string;
  leadStartDate?: string | null;
  firstMaterialShareDate?: string | null;
  slideFixDate?: string | null;
  status: WebinarStatus;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  webinarId: string;
  parentTemplateTaskId?: string | null;

  largeCategory: string;
  middleCategory: string;
  smallCategory: string;

  company?: string | null;
  assignee?: string | null;

  status: TaskStatus;

  effortDays?: number | null;

  startOffsetDays?: number | null;
  dueOffsetDays?: number | null;

  startDate?: string | null;
  dueDate?: string | null;
  completedDate?: string | null;

  note?: string | null;
  sortOrder: number;

  isManuallyOverridden?: boolean;

  createdAt: string;
  updatedAt: string;
};

export type TaskTemplate = {
  id: string;

  largeCategory: string;
  middleCategory: string;
  smallCategory: string;

  company?: string | null;
  assignee?: string | null;

  defaultStatus: TaskStatus;

  effortDays?: number | null;

  startOffsetDays?: number | null;
  dueOffsetDays?: number | null;

  note?: string | null;
  sortOrder: number;

  createdAt: string;
  updatedAt: string;
};

// Aggregate stats computed for a webinar.
export type WebinarStats = {
  total: number;
  done: number;
  progress: number; // 0-100
  overdue: number; // 期限超過（未完了かつ期日 < 今日）
  dueToday: number; // 今日が期日
  startToday: number; // 今日が着手日
  byStatus: Record<TaskStatus, number>;
  byAssignee: { assignee: string; open: number }[]; // 担当者ごとの未完了タスク数
};
