export const queryKeys = {
  currentUser: ["auth", "current-user"] as const,
  projects: ["projects"] as const,
  projectsPage: (page: number, size: number) => ["projects", page, size] as const,
  project: (projectId: number) => ["projects", projectId] as const,
  projectOverview: (projectId: number) => ["projects", projectId, "overview"] as const,
  projectLocations: (projectId: number) => ["projects", projectId, "locations"] as const,
  projectAssets: (projectId: number) => ["projects", projectId, "assets"] as const,
  projectCharacters: (projectId: number) => ["projects", projectId, "characters"] as const,
  projectCharacter: (projectId: number, characterId: number) =>
    ["projects", projectId, "characters", characterId] as const,
  story: (projectId: number) => ["projects", projectId, "story"] as const,
  chapters: (projectId: number, storyVersionId: number) =>
    ["projects", projectId, "storyVersions", storyVersionId, "chapters"] as const,
  chapter: (projectId: number, chapterId: number) =>
    ["projects", projectId, "chapters", chapterId] as const,
  chapterWorkspace: (projectId: number, chapterId: number) =>
    ["projects", projectId, "chapters", chapterId, "workspace"] as const,
  chapterLanguageStatus: (projectId: number, chapterId: number) =>
    ["projects", projectId, "chapters", chapterId, "language-status"] as const,
  chapterContentVariants: (projectId: number, chapterId: number) =>
    ["projects", projectId, "chapters", chapterId, "content-variants"] as const,
  storyboard: (projectId: number, chapterId: number) =>
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
