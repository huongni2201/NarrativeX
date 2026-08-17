import type { CreateProjectInput, GenerationJob, Project, StoryVersion } from "@/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export class ApiClientError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiClientError(problem?.detail ?? "Request failed", response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  listProjects: () => request<Project[]>("/api/v1/projects"),
  createProject: (input: CreateProjectInput) =>
    request<Project>("/api/v1/projects", { method: "POST", body: JSON.stringify(input) }),
  createStoryVersion: (projectId: number, input: { content: string; rightsAttestationAccepted: boolean }) =>
    request<StoryVersion>(`/api/v1/projects/${projectId}/stories`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  enqueueAnalysis: (projectId: number) =>
    request<GenerationJob>(`/api/v1/projects/${projectId}/analysis-jobs`, { method: "POST" }),
};
