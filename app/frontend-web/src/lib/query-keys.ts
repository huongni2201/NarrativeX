export const queryKeys = {
  currentUser: ["auth", "current-user"] as const,
  projects: ["projects"] as const,
  projectsPage: (page: number, size: number) => ["projects", page, size] as const,
  project: (projectId: number) => ["projects", projectId] as const,
  projectOverview: (projectId: number) => ["projects", projectId, "overview"] as const,
  story: (projectId: number) => ["projects", projectId, "story"] as const,
  chapters: (projectId: number, storyVersionId: number) =>
    ["projects", projectId, "storyVersions", storyVersionId, "chapters"] as const,
  chapter: (projectId: number, chapterId: number) =>
    ["projects", projectId, "chapters", chapterId] as const,
  chapterWorkspace: (projectId: number, chapterId: number) =>
    ["projects", projectId, "chapters", chapterId, "workspace"] as const,
  characters: ["characters"] as const,
  job: (jobId: string) => ["jobs", jobId] as const,
};
