export interface ApiProjectOverviewChapter {
  id: string;
  orderIndex: number;
  title: string;
  status: string;
  sceneCount: number;
  durationSeconds: number;
  updatedAt: string;
}

export interface ApiProjectOverview {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  metrics: {
    totalChapters: number;
    readyChapters: number;
    renderedChapters: number;
    totalScenes: number;
    estimatedDurationSeconds: number;
    approvedVisuals: number;
    processingJobs: number;
    overallProgress: number;
  };
  counts: {
    characters: number;
    locations: number;
    assets: number;
  };
  chapters: ApiProjectOverviewChapter[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function string(value: unknown): value is string {
  return typeof value === "string";
}

function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || string(value);
}

export function isApiProjectOverview(value: unknown): value is ApiProjectOverview {
  if (!record(value) || !record(value.metrics) || !record(value.counts) || !Array.isArray(value.chapters)) {
    return false;
  }

  const metrics = value.metrics;
  const counts = value.counts;
  return (
    string(value.id) &&
    string(value.name) &&
    nullableString(value.description) &&
    nullableString(value.coverImageUrl) &&
    string(value.status) &&
    string(value.createdAt) &&
    string(value.updatedAt) &&
    number(metrics.totalChapters) &&
    number(metrics.readyChapters) &&
    number(metrics.renderedChapters) &&
    number(metrics.totalScenes) &&
    number(metrics.estimatedDurationSeconds) &&
    number(metrics.approvedVisuals) &&
    number(metrics.processingJobs) &&
    number(metrics.overallProgress) &&
    number(counts.characters) &&
    number(counts.locations) &&
    number(counts.assets) &&
    value.chapters.every(
      (chapter) =>
        record(chapter) &&
        string(chapter.id) &&
        number(chapter.orderIndex) &&
        string(chapter.title) &&
        string(chapter.status) &&
        number(chapter.sceneCount) &&
        number(chapter.durationSeconds) &&
        string(chapter.updatedAt),
    )
  );
}
