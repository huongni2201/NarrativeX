import type { ApiResponse, FieldViolation } from "@narrativex/client-contracts";
import { requestAuthentication } from "./auth-required-event.ts";
import { isRecord, isString } from "./guards.ts";

const API_BASE_URL = (
  (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ??
  "http://localhost:8080"
).replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 30_000;

interface CsrfTokenResponse {
  token: string;
  headerName: string;
}

interface DesktopTransportResponse {
  status: number;
  statusText: string;
  bodyText: string;
}

interface ApiErrorDetails {
  code?: string;
  correlationId?: string;
  errors?: FieldViolation[];
}

let csrfTokenPromise: Promise<CsrfTokenResponse> | undefined;

export class DesktopApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly code?: string;
  readonly correlationId?: string;
  readonly errors?: FieldViolation[];

  constructor(
    path: string,
    status: number,
    message: string,
    details: ApiErrorDetails = {},
  ) {
    super(message);
    this.name = "DesktopApiError";
    this.status = status;
    this.path = path;
    this.code = details.code;
    this.correlationId = details.correlationId;
    this.errors = details.errors;
  }
}

export class DesktopApiProtocolError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`Invalid API response from ${path}.`);
    this.name = "DesktopApiProtocolError";
    this.path = path;
  }
}

export function apiBaseUrl(): string {
  return API_BASE_URL;
}

export function parseApiResponseBody<T>(path: string, bodyText: string): ApiResponse<T> {
  const value = parseJson(bodyText);
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isString(value.message) ||
    !isString(value.timestamp)
  ) {
    throw new DesktopApiProtocolError(path);
  }
  return value as unknown as ApiResponse<T>;
}

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CsrfTokenResponse>;
  return typeof candidate.token === "string" && typeof candidate.headerName === "string";
}

async function loadCsrfToken() {
  const path = "/api/v1/auth/csrf";
  const response = await desktopRequest(
    path,
    { headers: { Accept: "application/json" } },
    DEFAULT_TIMEOUT_MS,
  );
  if (!isSuccessful(response.status)) {
    throw buildApiError(path, response);
  }
  const envelope = parseApiResponseBody<unknown>(path, response.bodyText);
  if (!hasResponseData(envelope) || !isCsrfTokenResponse(envelope.data)) {
    throw new DesktopApiProtocolError(path);
  }
  return envelope.data;
}

function csrfToken() {
  csrfTokenPromise ??= loadCsrfToken().catch((error) => {
    csrfTokenPromise = undefined;
    throw error;
  });
  return csrfTokenPromise;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const envelope = await executeApiRequest(path, init, timeoutMs);
  if (!envelope || !hasResponseData(envelope)) {
    throw new DesktopApiProtocolError(path);
  }
  return envelope.data as T;
}

export async function apiCommand(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  await executeApiRequest(path, init, timeoutMs);
}

async function executeApiRequest(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<ApiResponse<unknown> | undefined> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const body = requestBody(init.body);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const token = await csrfToken();
    headers.set(token.headerName, token.token);
  }

  const response = await desktopRequest(
    path,
    {
      method,
      headers,
      body,
    },
    timeoutMs,
  );

  if (!isSuccessful(response.status)) {
    if (response.status === 401 || response.status === 403) csrfTokenPromise = undefined;
    const error = buildApiError(path, response);
    if (error.code === "AUTHENTICATION_REQUIRED") {
      requestAuthentication(error.message, path);
    }
    throw error;
  }

  if (response.status === 204) return undefined;
  return parseApiResponseBody<unknown>(path, response.bodyText);
}

function buildApiError(path: string, response: DesktopTransportResponse): DesktopApiError {
  const responseBody = parseJson(response.bodyText);
  const details = extractApiErrorDetails(responseBody);
  const message =
    isRecord(responseBody) && isString(responseBody.message) && responseBody.message
      ? responseBody.message
      : response.statusText || "Request failed";

  return new DesktopApiError(path, response.status, message, details);
}

function extractApiErrorDetails(value: unknown): ApiErrorDetails {
  if (!isRecord(value)) return {};

  const code = isString(value.code) ? value.code : undefined;
  const correlationId = isString(value.correlationId) ? value.correlationId : undefined;
  const errors = Array.isArray(value.errors)
    ? value.errors.filter(isFieldViolation)
    : undefined;

  return {
    code,
    correlationId,
    errors: errors?.length ? errors : undefined,
  };
}

function isFieldViolation(value: unknown): value is FieldViolation {
  return (
    isRecord(value) &&
    isString(value.field) &&
    isString(value.code) &&
    isString(value.messageKey) &&
    isString(value.message)
  );
}

function hasResponseData<T>(
  response: ApiResponse<T>,
): response is ApiResponse<T> & { data: T } {
  return Object.prototype.hasOwnProperty.call(response, "data");
}

async function desktopRequest(
  path: string,
  init: { method?: string; headers?: HeadersInit; body?: string },
  timeoutMs: number,
): Promise<DesktopTransportResponse> {
  if (!window.narrativex?.api) {
    throw new Error("NarrativeX backend transport is only available in Electron Desktop.");
  }
  const headers = new Headers(init.headers);
  return window.narrativex.api.request({
    path,
    method: init.method,
    headers: Object.fromEntries(headers.entries()),
    body: init.body,
    timeoutMs,
  });
}

function requestBody(body: BodyInit | null | undefined): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  throw new Error("Desktop API requests currently support string/JSON bodies only.");
}

function parseJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isSuccessful(status: number): boolean {
  return status >= 200 && status < 300;
}
