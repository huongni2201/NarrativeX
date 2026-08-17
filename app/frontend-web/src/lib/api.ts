import type {
  ApiAuthUser,
  ApiDataGuard,
  ApiFieldError,
  ApiGenerationJob,
  ApiProject,
  ApiStoryVersion,
  CreateProjectApiInput,
  CreateStoryVersionApiInput,
  ErrorResponse,
  PaginationResponse,
} from "@/types/api";
import {
  isApiAuthUser,
  isApiGenerationJob,
  isApiProject,
  isApiResponse,
  isApiStoryVersion,
  isErrorResponse,
  isPaginationResponse,
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

export class ApiProtocolError extends Error {
  readonly path: string;
  readonly payload: unknown;

  constructor(path: string, payload: unknown) {
    super(`Invalid success response from ${path}.`);
    this.name = "ApiProtocolError";
    this.path = path;
    this.payload = payload;
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

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { token?: unknown }).token === "string" &&
    typeof (value as { headerName?: unknown }).headerName === "string"
  );
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

  const payload = (await response.json()) as unknown;
  if (!isApiResponse(payload, isCsrfTokenResponse)) {
    throw new Error("The server did not return a usable CSRF token.");
  }
  return payload.data;
}

function csrfToken(): Promise<CsrfTokenResponse> {
  csrfTokenPromise ??= loadCsrfToken().catch((error) => {
    // Do not poison the module-level cache after a transient network/server
    // failure. A later mutation must be able to request a fresh token.
    resetCsrfToken();
    throw error;
  });
  return csrfTokenPromise;
}

async function request<T>(
  path: string,
  init: ApiRequestInit = {},
  dataGuard?: ApiDataGuard<T>,
): Promise<T> {
  const { json, parseJson = true, headers: initialHeaders, ...requestInit } = init;
  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    const requestWithBody: RequestInit = { ...requestInit, body: JSON.stringify(json) };
    return sendRequest<T>(path, requestWithBody, headers, parseJson, dataGuard);
  }

  return sendRequest<T>(path, requestInit, headers, parseJson, dataGuard);
}

async function sendRequest<T>(
  path: string,
  requestInit: RequestInit,
  headers: Headers,
  parseJson: boolean,
  dataGuard?: ApiDataGuard<T>,
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
    if (errorResponse.status === 401 || errorResponse.status === 403) {
      resetCsrfToken();
      if (errorResponse.status === 401) {
        useAuthStore.getState().setUnauthenticated();
      }
    }
    throw new ApiClientError(errorResponse);
  }

  if (response.status === 204 || !parseJson) {
    return undefined as T;
  }

  const envelope = (await response.json()) as unknown;
  if (!isApiResponse(envelope, dataGuard)) {
    throw new ApiProtocolError(path, envelope);
  }

  return envelope.data as T;
}

function projectListPath({ page = DEFAULT_PROJECT_PAGE, size = DEFAULT_PROJECT_PAGE_SIZE }: ProjectListParams = {}): string {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return `/api/v1/projects?${params.toString()}`;
}

export const api = {
  getCurrentUser: () => request<ApiAuthUser>("/api/auth/me", {}, isApiAuthUser),
  logout: () => request<void>("/logout", { method: "POST", parseJson: false }),
  googleLoginUrl: () => apiUrl("/oauth2/authorization/google"),
  listProjects: (params: ProjectListParams = {}) =>
    request<PaginationResponse<ApiProject>>(
      projectListPath(params),
      {},
      (value): value is PaginationResponse<ApiProject> => isPaginationResponse(value, isApiProject),
    ),
  createProject: (input: CreateProjectApiInput) =>
    request<ApiProject>("/api/v1/projects", { method: "POST", json: input }, isApiProject),
  createStoryVersion: (projectId: number, input: CreateStoryVersionApiInput) =>
    request<ApiStoryVersion>(
      `/api/v1/projects/${projectId}/stories`,
      { method: "POST", json: input },
      isApiStoryVersion,
    ),
  enqueueAnalysis: (projectId: number) =>
    request<ApiGenerationJob>(
      `/api/v1/projects/${projectId}/analysis-jobs`,
      { method: "POST" },
      isApiGenerationJob,
    ),
};

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError || error instanceof ApiProtocolError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
