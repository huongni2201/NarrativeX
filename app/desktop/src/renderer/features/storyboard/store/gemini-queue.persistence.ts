import type { GeminiQueueState } from "../model/gemini-queue.ts";

export interface GeminiQueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): GeminiQueueStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isGeminiQueueState(value: unknown): value is GeminiQueueState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeminiQueueState>;

  return (
    typeof candidate.chapterId === "string" &&
    isStringArray(candidate.beatIds) &&
    isStringArray(candidate.completedBeatIds) &&
    isStringArray(candidate.skippedBeatIds) &&
    typeof candidate.currentIndex === "number" &&
    Number.isInteger(candidate.currentIndex) &&
    candidate.currentIndex >= 0 &&
    (candidate.status === "RUNNING" ||
      candidate.status === "PAUSED" ||
      candidate.status === "COMPLETED")
  );
}

export function geminiQueueStorageKey(projectId: string, chapterId: string) {
  return `narrativex:gemini-web-queue:${projectId}:${chapterId}`;
}

export function loadGeminiQueue(
  projectId: string,
  chapterId: string,
  storage: GeminiQueueStorage | null = defaultStorage(),
): GeminiQueueState | null {
  if (!storage) return null;
  const raw = storage.getItem(geminiQueueStorageKey(projectId, chapterId));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isGeminiQueueState(parsed) && parsed.chapterId === chapterId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGeminiQueue(
  projectId: string,
  chapterId: string,
  state: GeminiQueueState | null,
  storage: GeminiQueueStorage | null = defaultStorage(),
) {
  if (!storage) return;
  const key = geminiQueueStorageKey(projectId, chapterId);

  if (!state) {
    storage.removeItem(key);
    return;
  }

  storage.setItem(key, JSON.stringify(state));
}
