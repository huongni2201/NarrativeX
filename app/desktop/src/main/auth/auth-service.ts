import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { DesktopApiResponse, DesktopBackendApiService } from "../api/backend-api-service";

const DESKTOP_REDIRECT_URI = "narrativex://auth/callback";
// This TTL only bounds how long the desktop keeps each PKCE verifier while the user is still
// completing Google sign-in. The backend handoff code has its own short TTL that starts only after
// OAuth succeeds and the callback is issued.
const DESKTOP_GOOGLE_LOGIN_PENDING_TTL_MS = 15 * 60_000;
const DESKTOP_AUTH_VERIFIER_BYTES = 32;
const ALLOWED_CSRF_HEADERS = new Set(["x-csrf-token", "x-xsrf-token"]);

export function createDesktopAuthVerifier(): string {
  return randomBytes(DESKTOP_AUTH_VERIFIER_BYTES).toString("base64url");
}

export function createDesktopAuthChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

interface CsrfTokenResponse {
  token: string;
  headerName: string;
}

interface PendingLogin {
  verifier: string;
  timer: ReturnType<typeof setTimeout>;
}

type OpenExternal = (url: string) => Promise<void>;

export class DesktopAuthService {
  private readonly pendingLogins = new Map<string, PendingLogin>();
  private readonly backendBaseUrl: string;
  private readonly backendApi: Pick<DesktopBackendApiService, "request">;
  private readonly openExternal: OpenExternal;

  constructor(
    backendBaseUrl: string,
    backendApi: Pick<DesktopBackendApiService, "request">,
    openExternal: OpenExternal,
  ) {
    this.backendBaseUrl = backendBaseUrl;
    this.backendApi = backendApi;
    this.openExternal = openExternal;
  }

  async login(): Promise<void> {
    const attemptId = randomUUID();
    const verifier = createDesktopAuthVerifier();
    const challenge = createDesktopAuthChallenge(verifier);
    const timer = setTimeout(
      () => this.clearPendingLogin(attemptId),
      DESKTOP_GOOGLE_LOGIN_PENDING_TTL_MS,
    );
    this.pendingLogins.set(attemptId, { verifier, timer });

    const startUrl = new URL("/api/v1/auth/desktop/start", `${this.backendBaseUrl}/`);
    startUrl.searchParams.set("redirect_uri", DESKTOP_REDIRECT_URI);
    startUrl.searchParams.set("code_challenge", challenge);
    startUrl.searchParams.set("attempt", attemptId);
    try {
      await this.openExternal(startUrl.toString());
    } catch (error) {
      this.clearPendingLogin(attemptId);
      throw error;
    }
  }

  async exchange(code: string, attemptId: string): Promise<DesktopApiResponse> {
    if (!code || !code.trim()) throw new Error("Desktop auth code is required.");
    if (!attemptId || !attemptId.trim()) throw new Error("Desktop auth attempt is required.");
    const normalizedAttemptId = attemptId.trim();
    const pending = this.pendingLogins.get(normalizedAttemptId);
    if (!pending) throw new Error("No pending desktop login attempt.");
    this.clearPendingLogin(normalizedAttemptId);

    return this.requestWithCsrf(
      "/api/v1/auth/desktop/exchange",
      JSON.stringify({ code: code.trim(), codeVerifier: pending.verifier }),
    );
  }

  async logout(): Promise<DesktopApiResponse> {
    this.clearPendingLogin();
    return this.requestWithCsrf("/logout");
  }

  clearPendingLogin(attemptId?: string): void {
    if (attemptId !== undefined) {
      const pending = this.pendingLogins.get(attemptId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pendingLogins.delete(attemptId);
      return;
    }

    for (const pending of this.pendingLogins.values()) clearTimeout(pending.timer);
    this.pendingLogins.clear();
  }

  private async requestWithCsrf(path: string, body?: string): Promise<DesktopApiResponse> {
    const csrf = await this.loadCsrfToken();
    return this.backendApi.request({
      path,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [csrf.headerName]: csrf.token,
      },
      body,
    });
  }

  private async loadCsrfToken(): Promise<CsrfTokenResponse> {
    const response = await this.backendApi.request({
      path: "/api/v1/auth/csrf",
      headers: { Accept: "application/json" },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error("Desktop CSRF token request failed.");
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(response.bodyText);
    } catch {
      throw new Error("Desktop CSRF token response is invalid.");
    }
    if (!envelope || typeof envelope !== "object") {
      throw new Error("Desktop CSRF token response is invalid.");
    }
    const data = (envelope as { data?: unknown }).data;
    if (!data || typeof data !== "object") {
      throw new Error("Desktop CSRF token response is invalid.");
    }
    const token = (data as Partial<CsrfTokenResponse>).token;
    const headerName = (data as Partial<CsrfTokenResponse>).headerName;
    if (
      typeof token !== "string" ||
      !token ||
      typeof headerName !== "string" ||
      !ALLOWED_CSRF_HEADERS.has(headerName.toLowerCase())
    ) {
      throw new Error("Desktop CSRF token response is invalid.");
    }
    return { token, headerName };
  }
}
