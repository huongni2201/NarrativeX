export type ProjectDashboardStatus = "ACTIVE" | "DRAFT";
export type ProjectDashboardSort = "NEWEST" | "OLDEST" | "NAME";

export interface ApiProjectDashboardItem {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  isStarred: boolean;
  metrics: {
    totalChapters: number;
    totalScenes: number;
    estimatedDurationSeconds: number;
  };
}

export interface ApiProjectDashboardPage {
  content: ApiProjectDashboardItem[];
  nextCursor: string | null;
  limit: number;
  hasNext: boolean;
  counts: {
    all: number;
    active: number;
    draft: number;
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isApiProjectDashboardPage(value: unknown): value is ApiProjectDashboardPage {
  if (!record(value) || !Array.isArray(value.content) || !record(value.counts)) return false;
  if (
    !number(value.limit) ||
    typeof value.hasNext !== "boolean" ||
    !(value.nextCursor === null || typeof value.nextCursor === "string") ||
    !number(value.counts.all) ||
    !number(value.counts.active) ||
    !number(value.counts.draft)
  ) return false;

  return value.content.every((item) => {
    if (!record(item) || !record(item.metrics)) return false;
    return (
      number(item.id) &&
      typeof item.name === "string" &&
      (item.description === null || typeof item.description === "string") &&
      (item.coverImageUrl === null || typeof item.coverImageUrl === "string") &&
      typeof item.status === "string" &&
      typeof item.createdAt === "string" &&
      typeof item.updatedAt === "string" &&
      typeof item.isStarred === "boolean" &&
      number(item.metrics.totalChapters) &&
      number(item.metrics.totalScenes) &&
      number(item.metrics.estimatedDurationSeconds)
    );
  });
}
