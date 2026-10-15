import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Standard Google OAuth 2.0 endpoints for installed applications. */
export const GOOGLE_ENDPOINTS = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  userInfo: "https://openidconnect.googleapis.com/v1/userinfo",
} as const;

export interface OAuthProfile {
  clientId: string;
  /** Google "Desktop" clients carry a secret that is not confidential; it is still never logged. */
  clientSecret: string | null;
  scopes: string[];
  /** Base URL of the Cloud Code style API that serves Antigravity models (HTTPS, *.googleapis.com only). */
  apiBaseUrl: string;
  userAgent: string;
  /** Client metadata sent with provider binding (loadCodeAssist). Pinned with the adapter revision. */
  metadata: Record<string, string>;
}

export type ProfileResult = { ok: true; profile: OAuthProfile } | { ok: false; issue: string };

export const PROFILE_FILE = "oauth-client.json";
const DEFAULT_SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/cloud-platform"];
const DEFAULT_API_BASE_URL = "https://cloudcode-pa.googleapis.com";
const DEFAULT_USER_AGENT = "antigravity";
const DEFAULT_METADATA = { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_METADATA };
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => /^[A-Za-z]{1,40}$/u.test(entry[0]) && typeof entry[1] === "string" && entry[1].length <= 80);
  return entries.length > 0 ? Object.fromEntries(entries) : { ...DEFAULT_METADATA };
}

/**
 * Validate a raw profile. The OAuth client is supplied by the user (file or environment) so that no
 * third-party client secret is committed to the repository. Bearer tokens are only ever sent to
 * HTTPS hosts under googleapis.com.
 */
export function validateProfile(raw: Record<string, unknown>): ProfileResult {
  const clientId = text(raw.clientId);
  if (!clientId) return { ok: false, issue: "OAUTH_CLIENT_MISSING" };
  if (!/^[A-Za-z0-9._-]{1,200}\.apps\.googleusercontent\.com$/u.test(clientId)) return { ok: false, issue: "OAUTH_CLIENT_INVALID" };
  const scopes = Array.isArray(raw.scopes) && raw.scopes.length > 0 ? raw.scopes.map(text) : DEFAULT_SCOPES;
  const allowed = /^(openid|email|profile|https:\/\/www\.googleapis\.com\/auth\/[A-Za-z0-9._-]+)$/u;
  if (scopes.some(scope => scope === null || !allowed.test(scope))) return { ok: false, issue: "OAUTH_SCOPE_INVALID" };
  const baseUrl = text(raw.apiBaseUrl) ?? DEFAULT_API_BASE_URL;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !/(^|\.)googleapis\.com$/u.test(url.hostname)) {
      return { ok: false, issue: "API_BASE_URL_INVALID" };
    }
  } catch {
    return { ok: false, issue: "API_BASE_URL_INVALID" };
  }
  return { ok: true, profile: {
    clientId,
    clientSecret: text(raw.clientSecret),
    scopes: scopes as string[],
    apiBaseUrl: baseUrl.replace(/\/+$/u, ""),
    userAgent: text(raw.userAgent) ?? DEFAULT_USER_AGENT,
    metadata: metadata(raw.metadata),
  } };
}

/** Environment variables override the profile file. */
export async function loadProfile(directory: string, env: NodeJS.ProcessEnv = process.env): Promise<ProfileResult> {
  let raw: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(await readFile(join(directory, PROFILE_FILE), "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed;
    else return { ok: false, issue: "OAUTH_PROFILE_INVALID" };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return { ok: false, issue: "OAUTH_PROFILE_INVALID" };
  }
  const overrides: Record<string, unknown> = {
    clientId: env.NARRATIVEX_ANTIGRAVITY_CLIENT_ID,
    clientSecret: env.NARRATIVEX_ANTIGRAVITY_CLIENT_SECRET,
    apiBaseUrl: env.NARRATIVEX_ANTIGRAVITY_API_BASE_URL,
    userAgent: env.NARRATIVEX_ANTIGRAVITY_USER_AGENT,
    scopes: env.NARRATIVEX_ANTIGRAVITY_SCOPES ? env.NARRATIVEX_ANTIGRAVITY_SCOPES.split(/\s+/u).filter(Boolean) : undefined,
  };
  for (const [key, value] of Object.entries(overrides)) if (value !== undefined && value !== "") raw[key] = value;
  return validateProfile(raw);
}
