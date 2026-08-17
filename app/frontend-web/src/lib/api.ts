import type {
  ApiAuthUser,
  ApiGenerationJob,
  ApiProblem,
  ApiProject,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
} from "@/types/api";
import { useAuthStore } from "@/store/useAuthStore";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "";

function apiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

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
  parseJson?: boolean;
}

interface CsrfTokenResponse {
  token: string;
  headerName: string;
}

let csrfTokenPromise: Promise<CsrfTokenResponse> | undefined;

function resetCsrfToken(): void {
  csrfTokenPromise = undefined;
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

async function loadCsrfToken(): Promise<CsrfTokenResponse> {
  const response = await fetch(apiUrl("/api/v1/auth/csrf"), {
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiClientError(await parseProblem(response));
  }

  const payload = (await response.json()) as Partial<CsrfTokenResponse>;
  if (!payload.token || !payload.headerName) {
    throw new Error("The server did not return a usable CSRF token.");
  }
  return { token: payload.token, headerName: payload.headerName };
}

function csrfToken(): Promise<CsrfTokenResponse> {
  csrfTokenPromise ??= loadCsrfToken();
  return csrfTokenPromise;
}

async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { json, parseJson = true, headers: initialHeaders, ...requestInit } = init;
  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json, application/problem+json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    const requestWithBody: RequestInit = { ...requestInit, body: JSON.stringify(json) };
    return sendRequest<T>(path, requestWithBody, headers, parseJson);
  }

  return sendRequest<T>(path, requestInit, headers, parseJson);
}

async function sendRequest<T>(path: string, requestInit: RequestInit, headers: Headers, parseJson: boolean): Promise<T> {
  const method = (requestInit.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = await csrfToken();
    headers.set(token.headerName, token.token);
  }

  const response = await fetch(apiUrl(path), {
    ...requestInit,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const problem = await parseProblem(response);
    if (problem.status === 401) {
      resetCsrfToken();
      useAuthStore.getState().setUnauthenticated();
    }
    throw new ApiClientError(problem);
  }

  if (response.status === 204 || !parseJson) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getCurrentUser: () => request<ApiAuthUser>("/api/auth/me"),
  logout: () => request<void>("/logout", { method: "POST", parseJson: false }),
  googleLoginUrl: () => apiUrl("/oauth2/authorization/google"),
  listProjects: () => request<ApiProject[]>("/api/v1/projects"),
  createProject: (input: CreateProjectApiInput) =>
    request<ApiProject>("/api/v1/projects", { method: "POST", json: input }),
  createStoryVersion: (projectId: number, input: CreateStoryVersionApiInput) =>
    request<ApiStoryVersion>(`/api/v1/projects/${projectId}/stories`, { method: "POST", json: input }),
  enqueueAnalysis: (projectId: number) =>
    request<ApiGenerationJob>(`/api/v1/projects/${projectId}/analysis-jobs`, { method: "POST" }),
};
