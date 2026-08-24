import type { ProjectId } from "@/types/api";

export const queryKeys = {
  currentUser: ["auth", "current-user"] as const,
  projects: ["projects"] as const,
  projectsPage: (page: number, size: number) => ["projects", page, size] as const,
  project: (projectId: ProjectId) => ["projects", projectId] as const,
  projectOverview: (projectId: ProjectId) => ["projects", projectId, "overview"] as const,
  projectLocations: (projectId: ProjectId) => ["projects", projectId, "locations"] as const,
  projectAssets: (projectId: ProjectId) => ["projects", projectId, "assets"] as const,
  projectCharacters: (projectId: ProjectId) => ["projects", projectId, "characters"] as const,
  projectCharacter: (projectId: ProjectId, characterId: string) =>
    ["projects", projectId, "characters", characterId] as const,
  story: (projectId: ProjectId) => ["projects", projectId, "story"] as const,
  chapters: (projectId: ProjectId, storyVersionId: string | number) =>
    ["projects", projectId, "storyVersions", storyVersionId, "chapters"] as const,
  chapter: (projectId: ProjectId, chapterId: string | number) =>
    ["projects", projectId, "chapters", chapterId] as const,
  chapterWorkspace: (projectId: ProjectId, chapterId: string | number) =>
    ["projects", projectId, "chapters", chapterId, "workspace"] as const,
  chapterLanguageStatus: (projectId: ProjectId, chapterId: string | number) =>
    ["projects", projectId, "chapters", chapterId, "language-status"] as const,
  chapterContentVariants: (projectId: ProjectId, chapterId: string | number) =>
    ["projects", projectId, "chapters", chapterId, "content-variants"] as const,
  storyboard: (projectId: ProjectId, chapterId: string | number) =>
    ["projects", projectId, "chapters", chapterId, "storyboard"] as const,
  characters: ["characters"] as const,
  assets: ["assets"] as const,
  stylePresets: ["style-presets"] as const,
  projectDashboard: ["project-dashboard"] as const,
  projectDashboardFiltered: (filter?: string, sort?: string, query?: string) =>
    ["project-dashboard", filter ?? "ALL", sort ?? "NEWEST", query ?? ""] as const,
  job: (jobId: string) => ["jobs", jobId] as const,
  mediaJob: (jobId: string) => ["media-jobs", jobId] as const,
  renderJob: (jobId: string) => ["render-jobs", jobId] as const,
  artifactByJobId: (jobId: string) => ["render-artifacts", "job", jobId] as const,
  artifact: (artifactId: number | string) => ["render-artifacts", artifactId] as const,
};
