import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { GOOGLE_ENDPOINTS, type OAuthProfile } from "./oauth-profile.ts";

export interface OAuthTokens { accessToken: string; refreshToken: string; expiresAt: number; scope: string }
export interface GoogleIdentity { subject: string; email: string | null }

export class OAuthError extends Error {
  constructor(readonly code: string, readonly httpStatus: number | null = null) { super(code); }
}

export interface OAuthDependencies {
  fetch: typeof fetch;
  /** Opens the Google consent page in the system browser. */
  openUrl(url: string): Promise<void>;
  now?(): number;
}

const base64Url = (bytes: Buffer): string => bytes.toString("base64url");

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(48));
  return { verifier, challenge: base64Url(createHash("sha256").update(verifier).digest()) };
}

export function buildAuthorizationUrl(profile: OAuthProfile, redirectUri: string, state: string, challenge: string): string {
  const url = new URL(GOOGLE_ENDPOINTS.authorize);
  url.search = new URLSearchParams({
    client_id: profile.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: profile.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    // Forces the account chooser and a refresh token so a second account can be added.
    prompt: "select_account consent",
  }).toString();
  return url.toString();
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const PAGE = (message: string) => `<!doctype html><meta charset="utf-8"><title>NarrativeX</title><body style="font-family:system-ui;margin:3rem"><h3>NarrativeX</h3><p>${message}</p></body>`;

/**
 * One-shot loopback receiver bound to 127.0.0.1. Only the first well-formed callback with a matching
 * state is accepted; everything else is rejected without side effects.
 */
export function startCallbackServer(expectedState: string, timeoutMs: number, signal?: AbortSignal): {
  redirectUri: Promise<string>; code: Promise<string>; close(): void;
} {
  let server: Server | null = createServer();
  let settled = false;
  let resolveRedirect!: (value: string) => void;
  let rejectRedirect!: (reason: Error) => void;
  const redirectUri = new Promise<string>((resolve, reject) => { resolveRedirect = resolve; rejectRedirect = reject; });
  let resolveCode!: (value: string) => void;
  let rejectCode!: (reason: Error) => void;
  const code = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });
  code.catch(() => undefined);
  redirectUri.catch(() => undefined);

  const close = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); server?.close(); server?.closeAllConnections(); server = null; };
  const fail = (error: OAuthError) => { if (settled) return; settled = true; rejectCode(error); rejectRedirect(error); close(); };
  const timer = setTimeout(() => fail(new OAuthError("LOGIN_TIMEOUT")), timeoutMs);
  const onAbort = () => fail(new OAuthError("LOGIN_CANCELLED"));
  if (signal?.aborted) queueMicrotask(onAbort); else signal?.addEventListener("abort", onAbort, { once: true });

  server.on("request", (request, response) => {
    const address = server?.address() as AddressInfo | null;
    const host = request.headers.host ?? "";
    // Reject DNS-rebinding style requests and anything that is not the single callback route.
    if (!address || host !== `127.0.0.1:${address.port}`) { response.writeHead(400).end(); return; }
    const url = new URL(request.url ?? "/", `http://${host}`);
    if (request.method !== "GET" || url.pathname !== "/callback") { response.writeHead(404).end(); return; }
    const state = url.searchParams.get("state") ?? "";
    if (settled || !safeEqual(state, expectedState)) { response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end(PAGE("Yêu cầu không hợp lệ.")); return; }
    const error = url.searchParams.get("error");
    const received = url.searchParams.get("code");
    if (error || !received) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" }).end(PAGE("Đăng nhập bị từ chối. Bạn có thể đóng tab này."));
      fail(new OAuthError(error === "access_denied" ? "LOGIN_DENIED" : "LOGIN_FAILED"));
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" })
      .end(PAGE("Đã đăng nhập Google. Bạn có thể đóng tab này và quay lại NarrativeX."));
    settled = true;
    resolveCode(received);
    close();
  });
  server.once("error", () => fail(new OAuthError("LOGIN_FAILED")));
  server.listen(0, "127.0.0.1", () => resolveRedirect(`http://127.0.0.1:${(server!.address() as AddressInfo).port}/callback`));
  return { redirectUri, code, close };
}

async function postForm(deps: OAuthDependencies, body: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await deps.fetch(GOOGLE_ENDPOINTS.token, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body).toString(),
  });
  let json: Record<string, unknown> = {};
  try { json = await response.json() as Record<string, unknown>; } catch { /* handled below */ }
  if (!response.ok) throw new OAuthError(json.error === "invalid_grant" ? "INVALID_GRANT" : "TOKEN_REQUEST_FAILED", response.status);
  return json;
}

function toTokens(json: Record<string, unknown>, now: number, previousRefresh?: string): OAuthTokens {
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : previousRefresh ?? "";
  const lifetime = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 0;
  if (!accessToken || !refreshToken || !lifetime) throw new OAuthError(refreshToken ? "TOKEN_RESPONSE_INVALID" : "NO_REFRESH_TOKEN");
  return { accessToken, refreshToken, expiresAt: now + lifetime * 1000, scope: typeof json.scope === "string" ? json.scope : "" };
}

export async function exchangeCode(profile: OAuthProfile, deps: OAuthDependencies, code: string, redirectUri: string, verifier: string): Promise<OAuthTokens> {
  const form: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: profile.clientId, code_verifier: verifier };
  if (profile.clientSecret) form.client_secret = profile.clientSecret;
  return toTokens(await postForm(deps, form), (deps.now ?? Date.now)());
}

export async function refreshAccessToken(profile: OAuthProfile, deps: OAuthDependencies, refreshToken: string): Promise<OAuthTokens> {
  const form: Record<string, string> = { grant_type: "refresh_token", refresh_token: refreshToken, client_id: profile.clientId };
  if (profile.clientSecret) form.client_secret = profile.clientSecret;
  return toTokens(await postForm(deps, form), (deps.now ?? Date.now)(), refreshToken);
}

export async function fetchIdentity(deps: OAuthDependencies, accessToken: string): Promise<GoogleIdentity> {
  const response = await deps.fetch(GOOGLE_ENDPOINTS.userInfo, {
    redirect: "error", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new OAuthError("IDENTITY_UNAVAILABLE");
  const json = await response.json() as Record<string, unknown>;
  if (typeof json.sub !== "string" || !json.sub) throw new OAuthError("IDENTITY_UNAVAILABLE");
  return { subject: json.sub, email: typeof json.email === "string" ? json.email : null };
}

export function missingScopes(requested: string[], granted: string): string[] {
  const have = new Set(granted.split(/\s+/u).filter(Boolean));
  return requested.filter(scope => !["openid", "email", "profile"].includes(scope) && !have.has(scope));
}

/** Interactive Google login in the system browser using PKCE and a one-shot loopback callback. */
export async function loginWithGoogle(profile: OAuthProfile, deps: OAuthDependencies, signal?: AbortSignal, timeoutMs = 5 * 60_000): Promise<{ tokens: OAuthTokens; identity: GoogleIdentity }> {
  const state = base64Url(randomBytes(32));
  const pkce = createPkcePair();
  const receiver = startCallbackServer(state, timeoutMs, signal);
  try {
    const redirectUri = await receiver.redirectUri;
    await deps.openUrl(buildAuthorizationUrl(profile, redirectUri, state, pkce.challenge));
    const code = await receiver.code;
    const tokens = await exchangeCode(profile, deps, code, redirectUri, pkce.verifier);
    if (missingScopes(profile.scopes, tokens.scope).length > 0) throw new OAuthError("SCOPE_NOT_GRANTED");
    return { tokens, identity: await fetchIdentity(deps, tokens.accessToken) };
  } finally {
    receiver.close();
  }
}

/** "name@gmail.com" -> "n***@gmail.com". Only the masked form is stored or shown. */
export function maskEmail(email: string | null): string {
  if (!email || !email.includes("@")) return "Tài khoản Google";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export const fingerprintOf = (subject: string): string => createHash("sha256").update(`google-sub:${subject}`).digest("hex");
