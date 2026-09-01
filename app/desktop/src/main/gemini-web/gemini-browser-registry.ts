import { createHash, randomUUID } from "node:crypto";

export const DEFAULT_GEMINI_BROWSER_ID = "browser-1";

export interface GeminiBrowserProfile {
  id: string;
  name: string;
  createdAt: string;
}

const BROWSER_ID_PATTERN = /^browser-[A-Za-z0-9-]+$/;
const BROWSER_NAME_PATTERN = /^Browser [1-9][0-9]*$/;

export function defaultGeminiBrowserProfile(now = new Date()): GeminiBrowserProfile {
  return {
    id: DEFAULT_GEMINI_BROWSER_ID,
    name: "Browser 1",
    createdAt: now.toISOString(),
  };
}

export function sanitizeGeminiBrowserProfiles(value: unknown): GeminiBrowserProfile[] {
  if (!Array.isArray(value)) return [defaultGeminiBrowserProfile()];
  const seen = new Set<string>();
  const sanitized: GeminiBrowserProfile[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<GeminiBrowserProfile>;
    if (
      typeof candidate.id !== "string" ||
      !BROWSER_ID_PATTERN.test(candidate.id) ||
      seen.has(candidate.id) ||
      typeof candidate.name !== "string" ||
      !BROWSER_NAME_PATTERN.test(candidate.name) ||
      typeof candidate.createdAt !== "string" ||
      Number.isNaN(Date.parse(candidate.createdAt))
    ) {
      continue;
    }
    seen.add(candidate.id);
    sanitized.push({
      id: candidate.id,
      name: candidate.name,
      createdAt: new Date(candidate.createdAt).toISOString(),
    });
  }
  return sanitized.length > 0 ? sanitized : [defaultGeminiBrowserProfile()];
}

export function addGeminiBrowserProfile(
  current: readonly GeminiBrowserProfile[],
  now = new Date(),
): GeminiBrowserProfile[] {
  const nextIndex =
    current.reduce((max, entry) => {
      const match = /^Browser (\d+)$/.exec(entry.name);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;
  return [
    ...current,
    {
      id: `browser-${randomUUID()}`,
      name: `Browser ${nextIndex}`,
      createdAt: now.toISOString(),
    },
  ];
}

export function removeGeminiBrowserProfile(
  current: readonly GeminiBrowserProfile[],
  browserId: string,
): GeminiBrowserProfile[] {
  if (current.length <= 1) {
    throw new Error("At least one Gemini browser must remain.");
  }
  if (!current.some((entry) => entry.id === browserId)) {
    throw new Error("Gemini browser was not found.");
  }
  return current.filter((entry) => entry.id !== browserId);
}

export function geminiBrowserUserKey(userId: string): string {
  return createHash("sha256").update(userId, "utf8").digest("hex").slice(0, 32);
}
