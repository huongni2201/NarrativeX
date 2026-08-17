export const queryKeys = {
  projects: ["projects"] as const,
  project: (projectId: number) => ["projects", projectId] as const,
  story: (projectId: number) => ["projects", projectId, "story"] as const,
  job: (jobId: string) => ["jobs", jobId] as const,
};
