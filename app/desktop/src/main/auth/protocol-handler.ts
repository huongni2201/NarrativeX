export function isNarrativeXProtocolUrl(value: string): boolean {
  return value.startsWith("narrativex://");
}

export function extractDesktopAuthCode(value: string): string | null {
  if (!isNarrativeXProtocolUrl(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "narrativex:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;
    const code = url.searchParams.get("code");
    return code?.trim() || null;
  } catch {
    return null;
  }
}
