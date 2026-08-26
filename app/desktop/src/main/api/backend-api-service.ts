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
