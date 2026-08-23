import type { ApiDataGuard, ApiFieldError, ErrorResponse } from "@/types/api";
import { isApiResponse, isErrorResponse } from "@/types/api";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export const DEFAULT_API_TIMEOUT_MS = 30_000;

interface ApiRequestInit extends Omit<RequestInit, "body"> {
  json?: unknown;
  body?: BodyInit;
  parseJson?: boolean;
  notifyUnauthorized?: boolean;
  timeoutMs?: number;
}

interface CsrfTokenResponse {
  token: string;
  headerName: string;
}

type UnauthorizedHandler = () => void;

let csrfTokenPromise: Promise<CsrfTokenResponse> | undefined;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

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

export class ApiRequestTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms.`);
    this.name = "ApiRequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function apiUrl(path: string) {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

export function subscribeUnauthorized(handler: UnauthorizedHandler) {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

function notifyUnauthorized() {
  unauthorizedHandlers.forEach((handler) => handler());
}

export function resetCsrfTokenCache() {
  csrfTokenPromise = undefined;
}

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CsrfTokenResponse>;
  return typeof candidate.token === "string" && typeof candidate.headerName === "string";
}

function correlationIdFrom(response: Response) {
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

  if (isErrorResponse(parsed)) return parsed;

  return {
    success: false,
    status: response.status,
    code: "HTTP_ERROR",
    message: response.statusText || "Request failed",
    correlationId: correlationIdFrom(response),
    timestamp: new Date().toISOString(),
  };
}

async function parseSuccessPayload(response: Response, path: string): Promise<unknown> {
  try {
    const raw = await response.text();
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    throw new ApiProtocolError(path, undefined);
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_API_TIMEOUT_MS,
): Promise<Response> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number.");
  }

  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;

  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new ApiRequestTimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function loadCsrfToken(): Promise<CsrfTokenResponse> {
  const response = await fetchWithTimeout(apiUrl("/api/v1/auth/csrf"), {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!response.ok) throw new ApiClientError(await parseErrorResponse(response));

  const payload = await parseSuccessPayload(response, "/api/v1/auth/csrf");
  if (!isApiResponse(payload, isCsrfTokenResponse)) {
    throw new ApiProtocolError("/api/v1/auth/csrf", payload);
  }
  return payload.data;
}

function csrfToken() {
  csrfTokenPromise ??= loadCsrfToken().catch((error) => {
    resetCsrfTokenCache();
    throw error;
  });
  return csrfTokenPromise;
}

export async function apiRequest<T>(
  path: string,
  init: ApiRequestInit = {},
  dataGuard?: ApiDataGuard<T>,
): Promise<T> {
  const {
    json,
    body,
    parseJson = true,
    notifyUnauthorized: notifyUnauthorizedOn401 = true,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    headers: initialHeaders,
    ...requestInit
  } = init;
  if (json !== undefined && body !== undefined) {
    throw new Error("apiRequest accepts either json or body, not both.");
  }

  const headers = new Headers(initialHeaders);
  headers.set("Accept", "application/json");

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    return sendRequest<T>(
      path,
      { ...requestInit, body: JSON.stringify(json) },
      headers,
      parseJson,
      notifyUnauthorizedOn401,
      timeoutMs,
      dataGuard,
    );
  }

  return sendRequest<T>(
    path,
    { ...requestInit, body },
    headers,
    parseJson,
    notifyUnauthorizedOn401,
    timeoutMs,
    dataGuard,
  );
}

async function sendRequest<T>(
  path: string,
  requestInit: RequestInit,
  headers: Headers,
  parseJson: boolean,
  notifyUnauthorizedOn401: boolean,
  timeoutMs: number,
  dataGuard?: ApiDataGuard<T>,
): Promise<T> {
  const method = (requestInit.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = await csrfToken();
    headers.set(token.headerName, token.token);
  }

  const response = await fetchWithTimeout(
    apiUrl(path),
    {
      ...requestInit,
      headers,
      credentials: "include",
    },
    timeoutMs,
  );

  if (!response.ok) {
    const errorResponse = await parseErrorResponse(response);
    if (errorResponse.status === 401 || errorResponse.status === 403) resetCsrfTokenCache();
    if (errorResponse.status === 401 && notifyUnauthorizedOn401) notifyUnauthorized();
    throw new ApiClientError(errorResponse);
  }

  if (response.status === 204 || !parseJson) return undefined as T;

  const envelope = await parseSuccessPayload(response, path);
  if (!isApiResponse(envelope, dataGuard)) throw new ApiProtocolError(path, envelope);
  return envelope.data as T;
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (
    error instanceof ApiClientError ||
    error instanceof ApiProtocolError ||
    error instanceof ApiRequestTimeoutError
  ) {
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
