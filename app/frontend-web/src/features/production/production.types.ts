import type { ApiProjectOverview, ApiProjectOverviewChapter } from "@/features/projects/api/project-overview.types";

export type ProductionTab =
  | "chapters"
  | "storyboard"
  | "info"
  | "characters"
  | "locations"
  | "assets"
  | "settings";

const productionTabs: readonly ProductionTab[] = [
  "chapters",
  "storyboard",
  "info",
  "characters",
  "locations",
  "assets",
  "settings",
];

export function isProductionTab(value: string | null): value is ProductionTab {
  return value !== null && productionTabs.includes(value as ProductionTab);
}

export type ProductionProject = ApiProjectOverview;
export type ProductionMetrics = ApiProjectOverview["metrics"];
export type ProductionChapter = ApiProjectOverviewChapter;

