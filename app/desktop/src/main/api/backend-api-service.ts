import type { Session } from "electron";

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

export interface DesktopApiRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface DesktopApiResponse {
  status: number;
  statusText: string;
  bodyText: string;
}

export class DesktopBackendApiService {
  private readonly backendOrigin: string;

  constructor(
    private readonly backendBaseUrl: string,
    private readonly browserSession: Session,
  ) {
    this.backendOrigin = new URL(backendBaseUrl).origin;
  }

  async request(input: DesktopApiRequest): Promise<DesktopApiResponse> {
    const method = (input.method ?? "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      throw new Error(`Unsupported desktop API method: ${method}`);
    }

    const url = this.resolveAllowedUrl(input.path);
    const headers = new Headers();
    for (const [name, value] of Object.entries(input.headers ?? {})) {
      if (!ALLOWED_REQUEST_HEADERS.has(name.toLowerCase())) {
        throw new Error(`Unsupported desktop API header: ${name}`);
      }
      headers.set(name, value);
    }

    const response = await this.browserSession.fetch(url.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : input.body,
      credentials: "include",
      redirect: "error",
    });

    return {
      status: response.status,
      statusText: response.statusText,
      bodyText: method === "HEAD" || response.status === 204 ? "" : await response.text(),
    };
  }

  private resolveAllowedUrl(path: string): URL {
    if (!path.startsWith("/")) throw new Error("Desktop API path must be absolute.");
    if (!(path.startsWith("/api/v1/") || path === "/logout")) {
      throw new Error(`Desktop API path is not allowlisted: ${path}`);
    }

    const url = new URL(path, this.backendBaseUrl);
    if (url.origin !== this.backendOrigin) {
      throw new Error("Desktop API request cannot leave the configured backend origin.");
    }
    return url;
  }
}
