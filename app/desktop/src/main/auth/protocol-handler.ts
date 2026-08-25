const DESKTOP_HANDOFF_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isNarrativeXProtocolUrl(value: string): boolean {
  return value.startsWith("narrativex://");
}

export function extractDesktopAuthCode(value: string): string | null {
  if (!isNarrativeXProtocolUrl(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "narrativex:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;
    const queryKeys = [...url.searchParams.keys()];
    if (queryKeys.length !== 1 || queryKeys[0] !== "code") return null;
    const code = url.searchParams.get("code");
    const normalized = code?.trim() || "";
    return DESKTOP_HANDOFF_CODE_PATTERN.test(normalized) ? normalized : null;
  } catch {
    return null;
  }
}
