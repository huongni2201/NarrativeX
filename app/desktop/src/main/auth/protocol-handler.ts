const DESKTOP_HANDOFF_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DESKTOP_ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DESKTOP_AUTH_ERROR = "authentication_failed";

export interface DesktopAuthCodeCallback {
  code: string;
  attemptId: string;
}

export interface DesktopAuthErrorCallback {
  error: typeof DESKTOP_AUTH_ERROR;
  attemptId: string | null;
}

export function isNarrativeXProtocolUrl(value: string): boolean {
  return value.startsWith("narrativex://");
}

export function extractDesktopAuthCode(value: string): DesktopAuthCodeCallback | null {
  if (!isNarrativeXProtocolUrl(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "narrativex:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;
    const queryKeys = [...url.searchParams.keys()].sort();
    if (queryKeys.length !== 2 || queryKeys[0] !== "attempt" || queryKeys[1] !== "code") return null;
    const code = url.searchParams.get("code")?.trim() || "";
    const attemptId = url.searchParams.get("attempt")?.trim() || "";
    return DESKTOP_HANDOFF_CODE_PATTERN.test(code) && DESKTOP_ATTEMPT_ID_PATTERN.test(attemptId)
      ? { code, attemptId }
      : null;
  } catch {
    return null;
  }
}

export function extractDesktopAuthError(value: string): DesktopAuthErrorCallback | null {
  if (!isNarrativeXProtocolUrl(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "narrativex:" ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback"
    ) return null;
    const queryKeys = [...url.searchParams.keys()].sort();
    if (url.searchParams.get("error") !== DESKTOP_AUTH_ERROR) return null;
    if (queryKeys.length === 1 && queryKeys[0] === "error") {
      return { error: DESKTOP_AUTH_ERROR, attemptId: null };
    }
    if (queryKeys.length !== 2 || queryKeys[0] !== "attempt" || queryKeys[1] !== "error") {
      return null;
    }
    const attemptId = url.searchParams.get("attempt")?.trim() || "";
    return DESKTOP_ATTEMPT_ID_PATTERN.test(attemptId)
      ? { error: DESKTOP_AUTH_ERROR, attemptId }
      : null;
  } catch {
    return null;
  }
}
