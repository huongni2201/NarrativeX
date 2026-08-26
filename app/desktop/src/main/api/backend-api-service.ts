import type { Session } from "electron";
import type { GuestDeviceIdentity } from "../auth/guest-device-identity";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
const ALLOWED_REQUEST_HEADERS = new Set([
  "accept",
  "content-type",
  "x-csrf-token",
  "x-xsrf-token",
  "x-correlation-id",
  "if-match",
  "idempotency-key",
]);
const MAX_TIMEOUT_MS = 120_000;
const GUEST_SESSION_PATH = "/api/v1/auth/desktop/guest";

export interface DesktopApiRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface DesktopApiResponse {
  status: number;
  statusText: string;
  bodyText: string;
}

export interface DesktopSseEvent {
  event: string;
  data: string;
  id: string | null;
  retry: number | null;
}

export interface GuestIdentityProvider {
  loadOrCreate(): Promise<GuestDeviceIdentity>;
}

let defaultGuestIdentityStorePromise: Promise<GuestIdentityProvider> | undefined;

async function defaultGuestIdentityStore(): Promise<GuestIdentityProvider> {
  defaultGuestIdentityStorePromise ??= import("../auth/guest-device-identity")
    .then(({ GuestDeviceIdentityStore }) => new GuestDeviceIdentityStore())
    .catch((error) => {
      defaultGuestIdentityStorePromise = undefined;
      throw error;
    });
  return defaultGuestIdentityStorePromise;
}

const defaultGuestIdentityProvider: GuestIdentityProvider = {
  async loadOrCreate() {
    return (await defaultGuestIdentityStore()).loadOrCreate();
  },
};

export class DesktopBackendApiService {
  private readonly backendOrigin: string;

  constructor(
    private readonly backendBaseUrl: string,
    private readonly browserSession: Session,
    private readonly guestIdentity: GuestIdentityProvider = defaultGuestIdentityProvider,
  ) {
    this.backendOrigin = new URL(backendBaseUrl).origin;
  }

  async request(input: DesktopApiRequest): Promise<DesktopApiResponse> {
    const method = (input.method ?? "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      throw new Error(`Unsupported desktop API method: ${method}`);
    }

    const timeoutMs = input.timeoutMs ?? 30_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error(`Desktop API timeout must be between 1 and ${MAX_TIMEOUT_MS} ms.`);
    }

    const url = this.resolveAllowedUrl(input.path);
    const headers = new Headers();
    for (const [name, value] of Object.entries(input.headers ?? {})) {
      if (!ALLOWED_REQUEST_HEADERS.has(name.toLowerCase())) {
        throw new Error(`Unsupported desktop API header: ${name}`);
      }
      headers.set(name, value);
    }

    let body = input.body;
    if (url.pathname === GUEST_SESSION_PATH) {
      if (method !== "POST") throw new Error("Desktop guest session requires POST.");
      const identity = await this.guestIdentity.loadOrCreate();
      headers.set("Content-Type", "application/json");
      body = JSON.stringify({ deviceId: identity.deviceId, secret: identity.secret });
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error(`Desktop API request timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    );
    try {
      const response = await this.browserSession.fetch(url.toString(), {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        credentials: "include",
        redirect: "error",
        signal: controller.signal,
      });

      return {
        status: response.status,
        statusText: response.statusText,
        bodyText: method === "HEAD" || response.status === 204 ? "" : await response.text(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async streamEvents(
    path: string,
    onEvent: (event: DesktopSseEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const url = this.resolveAllowedUrl(path);
    const response = await this.browserSession.fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      credentials: "include",
      redirect: "error",
      signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Desktop SSE request failed with ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 240)}` : ""}`,
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/event-stream")) {
      throw new Error(`Desktop SSE endpoint returned unsupported content type: ${contentType || "unknown"}.`);
    }
    if (!response.body) throw new Error("Desktop SSE endpoint returned an empty response body.");

    const parser = new SseEventParser(onEvent);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (!signal.aborted) {
        const result = await reader.read();
        if (result.done) break;
        parser.push(decoder.decode(result.value, { stream: true }));
      }
      parser.push(decoder.decode());
      parser.finish();
    } finally {
      reader.releaseLock();
    }
  }

  private resolveAllowedUrl(path: string): URL {
    if (!path.startsWith("/")) throw new Error("Desktop API path must be absolute.");

    const url = new URL(path, this.backendBaseUrl);
    if (url.origin !== this.backendOrigin) {
      throw new Error("Desktop API request cannot leave the configured backend origin.");
    }
    if (!(url.pathname.startsWith("/api/v1/") || url.pathname === "/logout")) {
      throw new Error(`Desktop API path is not allowlisted: ${url.pathname}`);
    }
    return url;
  }
}

class SseEventParser {
  private buffer = "";
  private eventName = "message";
  private dataLines: string[] = [];
  private eventId: string | null = null;
  private retry: number | null = null;

  constructor(private readonly emit: (event: DesktopSseEvent) => void) {}

  push(chunk: string): void {
    if (!chunk) return;
    this.buffer += chunk;
    while (true) {
      const match = /\r\n|\r|\n/u.exec(this.buffer);
      if (!match || match.index === undefined) return;
      const line = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      this.consumeLine(line);
    }
  }

  finish(): void {
    if (this.buffer) {
      this.consumeLine(this.buffer);
      this.buffer = "";
    }
    this.dispatch();
  }

  private consumeLine(line: string): void {
    if (line === "") {
      this.dispatch();
      return;
    }
    if (line.startsWith(":")) return;

    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    switch (field) {
      case "event":
        this.eventName = value || "message";
        break;
      case "data":
        this.dataLines.push(value);
        break;
      case "id":
        if (!value.includes("\0")) this.eventId = value;
        break;
      case "retry": {
        const retry = Number.parseInt(value, 10);
        if (/^\d+$/u.test(value) && Number.isSafeInteger(retry)) this.retry = retry;
        break;
      }
    }
  }

  private dispatch(): void {
    if (this.dataLines.length === 0) {
      this.resetEventFields();
      return;
    }
    this.emit({
      event: this.eventName,
      data: this.dataLines.join("\n"),
      id: this.eventId,
      retry: this.retry,
    });
    this.resetEventFields();
  }

  private resetEventFields(): void {
    this.eventName = "message";
    this.dataLines = [];
    this.eventId = null;
    this.retry = null;
  }
}
