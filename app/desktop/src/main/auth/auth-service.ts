import { createHash, randomBytes } from "node:crypto";
import type { DesktopApiResponse, DesktopBackendApiService } from "../api/backend-api-service";

const DESKTOP_REDIRECT_URI = "narrativex://auth/callback";
// This TTL only bounds how long the desktop keeps the PKCE verifier while the user is still
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

type OpenExternal = (url: string) => Promise<void>;

export class DesktopAuthService {
  private pendingVerifier: string | null = null;
  private pendingVerifierTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.clearPendingLogin();
    const verifier = createDesktopAuthVerifier();
    const challenge = createDesktopAuthChallenge(verifier);
    this.pendingVerifier = verifier;
    this.pendingVerifierTimer = setTimeout(
      () => this.clearPendingLogin(),
      DESKTOP_GOOGLE_LOGIN_PENDING_TTL_MS,
    );

    const startUrl = new URL("/api/v1/auth/desktop/start", `${this.backendBaseUrl}/`);
    startUrl.searchParams.set("redirect_uri", DESKTOP_REDIRECT_URI);
    startUrl.searchParams.set("code_challenge", challenge);
    try {
      await this.openExternal(startUrl.toString());
    } catch (error) {
      this.clearPendingLogin();
      throw error;
    }
  }

  async exchange(code: string): Promise<DesktopApiResponse> {
    if (!code || !code.trim()) throw new Error("Desktop auth code is required.");
    const verifier = this.pendingVerifier;
    if (!verifier) throw new Error("No pending desktop login attempt.");
    this.clearPendingLogin();

    return this.requestWithCsrf(
      "/api/v1/auth/desktop/exchange",
      JSON.stringify({ code: code.trim(), codeVerifier: verifier }),
    );
  }

  async logout(): Promise<DesktopApiResponse> {
    this.clearPendingLogin();
    return this.requestWithCsrf("/logout");
  }

  clearPendingLogin(): void {
    this.pendingVerifier = null;
    if (this.pendingVerifierTimer !== null) {
      clearTimeout(this.pendingVerifierTimer);
      this.pendingVerifierTimer = null;
    }
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