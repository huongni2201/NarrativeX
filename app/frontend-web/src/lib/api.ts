import type {
  ApiAuthUser,
  ApiFieldError,
  ApiGenerationJob,
  ApiProject,
  ApiResponse,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
  ErrorResponse,
  PaginationResponse,
} from "@/types/api";
import { useAuthStore } from "@/store/useAuthStore";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : "";

const DEFAULT_PROJECT_PAGE = 0;
const DEFAULT_PROJECT_PAGE_SIZE = 20;

function apiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  readonly errors?: ApiFieldError[];
  readonly response: ErrorResponse;

  constructor(response: ErrorResponse) {
    super(response.message);
    this.name = "ApiClientError";
    this.status = response.status;
    this.code = response.code;
    this.correlationId = response.correlationId;
    this.errors = response.errors;
    this.response = response;
  }
}

interface ApiRequestInit extends Omit<RequestInit, "body"> {
  json?: unknown;
  parseJson?: boolean;
}

export interface ProjectListParams {
  page?: number;
  size?: number;
}

interface CsrfTokenResponse {
  token: string;
  headerName: string;
}

let csrfTokenPromise: Promise<CsrfTokenResponse> | undefined;

function resetCsrfToken(): void {
  csrfTokenPromise = undefined;
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { success?: unknown }).success === true &&
    typeof (value as { message?: unknown }).message === "string" &&
    "data" in value &&
    typeof (value as { timestamp?: unknown }).timestamp === "string"
  );
}

function isApiFieldError(value: unknown): value is ApiFieldError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { field?: unknown }).field === "string" &&
    (typeof (value as { code?: unknown }).code === "undefined" ||
      typeof (value as { code?: unknown }).code === "string") &&
    (typeof (value as { message?: unknown }).message === "undefined" ||
      typeof (value as { message?: unknown }).message === "string")
  );
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { success?: unknown }).success !== false ||
    typeof (value as { status?: unknown }).status !== "number" ||
    typeof (value as { code?: unknown }).code !== "string" ||
    typeof (value as { message?: unknown }).message !== "string" ||
    typeof (value as { timestamp?: unknown }).timestamp !== "string"
  ) {
    return false;
  }

  const errors = (value as { errors?: unknown }).errors;
  return typeof errors === "undefined" || (Array.isArray(errors) && errors.every(isApiFieldError));
}

function correlationIdFrom(response: Response): string | undefined {
  return response.headers.get("X-Correlation-Id") || undefined;
}

export async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
  let parsed: unknown;

  try {
    const raw = await response.text();
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }

  if (isErrorResponse(parsed)) {
    return parsed;
  }

  return {
    success: false,
    status: response.status,
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
    correlationId: correlationIdFrom(response),
    timestamp: new Date().toISOString(),
  };
}

async function loadCsrfToken(): Promise<CsrfTokenResponse> {
  const response = await fetch(apiUrl("/api/v1/auth/csrf"), {
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiClientError(await parseErrorResponse(response));
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
  headers.set("Accept", "application/json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    const requestWithBody: RequestInit = { ...requestInit, body: JSON.stringify(json) };
    return sendRequest<T>(path, requestWithBody, headers, parseJson);
  }

  return sendRequest<T>(path, requestInit, headers, parseJson);
}

async function sendRequest<T>(
  path: string,
  requestInit: RequestInit,
  headers: Headers,
  parseJson: boolean,
): Promise<T> {
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
    const errorResponse = await parseErrorResponse(response);
    if (errorResponse.status === 401) {
      resetCsrfToken();
      useAuthStore.getState().setUnauthenticated();
    }
    throw new ApiClientError(errorResponse);
  }

  if (response.status === 204 || !parseJson) {
    return undefined as T;
  }

  const envelope = (await response.json()) as unknown;
  if (!isApiResponse(envelope)) {
    throw new Error("The server returned an invalid success response.");
  }

  return envelope.data as T;
}

function projectListPath({ page = DEFAULT_PROJECT_PAGE, size = DEFAULT_PROJECT_PAGE_SIZE }: ProjectListParams = {}): string {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return `/api/v1/projects?${params.toString()}`;
}

export const api = {
  getCurrentUser: () => request<ApiAuthUser>("/api/auth/me"),
  logout: () => request<void>("/logout", { method: "POST", parseJson: false }),
  googleLoginUrl: () => apiUrl("/oauth2/authorization/google"),
  listProjects: (params: ProjectListParams = {}) =>
    request<PaginationResponse<ApiProject>>(projectListPath(params)),
  createProject: (input: CreateProjectApiInput) =>
    request<ApiProject>("/api/v1/projects", { method: "POST", json: input }),
  createStoryVersion: (projectId: number, input: CreateStoryVersionApiInput) =>
    request<ApiStoryVersion>(`/api/v1/projects/${projectId}/stories`, { method: "POST", json: input }),
  enqueueAnalysis: (projectId: number) =>
    request<ApiGenerationJob>(`/api/v1/projects/${projectId}/analysis-jobs`, { method: "POST" }),
};
