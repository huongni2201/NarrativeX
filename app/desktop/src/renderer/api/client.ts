const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 30_000;

interface CsrfTokenResponse {
  token: string;
  headerName: string;
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

export function apiBaseUrl() {
  return API_BASE_URL;
}

function isCsrfTokenResponse(value: unknown): value is CsrfTokenResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CsrfTokenResponse>;
  return typeof candidate.token === "string" && typeof candidate.headerName === "string";
}

async function loadCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new DesktopApiError("/api/v1/auth/csrf", response.status, response.statusText || "CSRF token request failed");
  const envelope = (await response.json()) as { success?: boolean; data?: unknown };
  if (envelope.success !== true || !isCsrfTokenResponse(envelope.data)) throw new DesktopApiProtocolError("/api/v1/auth/csrf");
  return envelope.data;
}

function csrfToken() {
  csrfTokenPromise ??= loadCsrfToken().catch((error) => {
    csrfTokenPromise = undefined;
    throw error;
  });
  return csrfTokenPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const token = await csrfToken();
      headers.set(token.headerName, token.token);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers,
    });
    if (!response.ok) {
      let message = response.statusText || "Request failed";
      try {
        const body = (await response.json()) as { message?: string };
        message = body.message || message;
      } catch {
        // Keep the HTTP status message when the server does not return JSON.
      }
      if (response.status === 401 || response.status === 403) csrfTokenPromise = undefined;
      throw new DesktopApiError(path, response.status, message);
    }
    if (response.status === 204) return undefined as T;
    const envelope = (await response.json()) as { success?: boolean; data?: T; message?: string };
    if (envelope.success !== true || !("data" in envelope)) throw new DesktopApiProtocolError(path);
    return envelope.data as T;
  } finally {
    window.clearTimeout(timeout);
  }
}
