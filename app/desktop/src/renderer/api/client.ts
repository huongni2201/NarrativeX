const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);
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

let csrfTokenPromise: Promise<CsrfTokenResponse> | undefined;

export class DesktopApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(path: string, status: number, message: string) {
    super(message);
    this.name = "DesktopApiError";
    this.status = status;
    this.path = path;
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

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CsrfTokenResponse>;
  return typeof candidate.token === "string" && typeof candidate.headerName === "string";
}

async function loadCsrfToken() {
  const response = await desktopRequest(
    "/api/v1/auth/csrf",
    { headers: { Accept: "application/json" } },
    DEFAULT_TIMEOUT_MS,
  );
  if (!isSuccessful(response.status)) {
    throw new DesktopApiError(
      "/api/v1/auth/csrf",
      response.status,
      response.statusText || "CSRF token request failed",
    );
  }
  const envelope = parseJson(response.bodyText) as { success?: boolean; data?: unknown } | null;
  if (envelope?.success !== true || !isCsrfTokenResponse(envelope.data)) {
    throw new DesktopApiProtocolError("/api/v1/auth/csrf");
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
) {
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
    let message = response.statusText || "Request failed";
    const responseBody = parseJson(response.bodyText) as { message?: unknown } | null;
    if (typeof responseBody?.message === "string" && responseBody.message) {
      message = responseBody.message;
    }
    if (response.status === 401 || response.status === 403) csrfTokenPromise = undefined;
    throw new DesktopApiError(path, response.status, message);
  }

  if (response.status === 204) return undefined as T;
  const envelope = parseJson(response.bodyText) as {
    success?: boolean;
    data?: T;
    message?: string;
  } | null;
  if (envelope?.success !== true || !("data" in envelope)) {
    throw new DesktopApiProtocolError(path);
  }
  return envelope.data as T;
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
