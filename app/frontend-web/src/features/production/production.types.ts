import type { ApiProjectOverview, ApiProjectOverviewChapter } from "@/features/projects/api/project-overview.types";

export type ProductionTab =
  | "chapters"
  | "storyboard"
  | "info"
  | "characters"
  | "locations"
  | "assets"
  | "settings";

export type ProductionProject = ApiProjectOverview;
export type ProductionMetrics = ApiProjectOverview["metrics"];
export type ProductionChapter = ApiProjectOverviewChapter;

