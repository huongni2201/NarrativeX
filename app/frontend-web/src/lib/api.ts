import type {
  ApiGenerationJob,
  ApiProblem,
  ApiProject,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
} from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly messageKey?: string;
  readonly correlationId?: string;
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem, fallbackMessage = "Request failed") {
    super(problem.detail || fallbackMessage);
    this.name = "ApiClientError";
    this.status = problem.status;
    this.code = problem.code;
    this.messageKey = problem.messageKey;
    this.correlationId = problem.correlationId;
    this.problem = problem;
  }
}

interface ApiRequestInit extends Omit<RequestInit, "body"> {
  json?: unknown;
}

function isApiProblem(value: unknown): value is ApiProblem {
  return typeof value === "object" && value !== null && typeof (value as { status?: unknown }).status === "number";
}

async function parseProblem(response: Response): Promise<ApiProblem> {
  const raw = await response.text();
  let parsed: unknown;

  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }

  if (isApiProblem(parsed)) {
    return parsed;
  }

  return {
    status: response.status,
    detail: response.status >= 500 ? "The server could not complete the request." : "The request was rejected.",
    correlationId: response.headers.get("X-Correlation-Id") || undefined,
  };
}

async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { json, headers: initialHeaders, ...requestInit } = init;
  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json, application/problem+json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    const requestWithBody: RequestInit = { ...requestInit, body: JSON.stringify(json) };
    return sendRequest<T>(path, requestWithBody, headers);
  }

  return sendRequest<T>(path, requestInit, headers);
}

async function sendRequest<T>(path: string, requestInit: RequestInit, headers: Headers): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiClientError(await parseProblem(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listProjects: () => request<ApiProject[]>("/api/v1/projects"),
  createProject: (input: CreateProjectApiInput) =>
    request<ApiProject>("/api/v1/projects", { method: "POST", json: input }),
  createStoryVersion: (projectId: number, input: CreateStoryVersionApiInput) =>
    request<ApiStoryVersion>(`/api/v1/projects/${projectId}/stories`, { method: "POST", json: input }),
  enqueueAnalysis: (projectId: number) =>
    request<ApiGenerationJob>(`/api/v1/projects/${projectId}/analysis-jobs`, { method: "POST" }),
};
