import {
  migrateLegacyGeminiQueue,
  type GeminiQueueAttempt,
  type GeminiQueueState,
} from "../model/gemini-queue.ts";

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

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every((item) => typeof item === "string"),
  );
}

function isAttempt(value: unknown): value is GeminiQueueAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<GeminiQueueAttempt>;
  return (
    typeof attempt.attemptId === "string" &&
    typeof attempt.snapshotId === "string" &&
    typeof attempt.inputFingerprint === "string" &&
    (attempt.stage === "PREPARED" ||
      attempt.stage === "SUBMITTING" ||
      attempt.stage === "UNKNOWN" ||
      attempt.stage === "COMPLETED" ||
      attempt.stage === "FAILED")
  );
}

function isAttemptRecord(value: unknown): value is Record<string, GeminiQueueAttempt> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.values(value).every(isAttempt),
  );
}

function isQueueStatus(value: unknown) {
  return value === "RUNNING" || value === "PAUSED" || value === "COMPLETED";
}

function isGeminiQueueState(value: unknown): value is GeminiQueueState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeminiQueueState>;

  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.chapterId === "string" &&
    (candidate.batchId === null || typeof candidate.batchId === "string") &&
    (candidate.batchFingerprint === null || typeof candidate.batchFingerprint === "string") &&
    (candidate.storyboardRevisionId === null || typeof candidate.storyboardRevisionId === "string") &&
    (candidate.sourceHash === null || typeof candidate.sourceHash === "string") &&
    isStringArray(candidate.beatIds) &&
    isStringRecord(candidate.snapshotIdsByBeat) &&
    isStringArray(candidate.completedBeatIds) &&
    isStringArray(candidate.skippedBeatIds) &&
    isAttemptRecord(candidate.attemptsByBeat) &&
    typeof candidate.currentIndex === "number" &&
    Number.isInteger(candidate.currentIndex) &&
    candidate.currentIndex >= 0 &&
    isQueueStatus(candidate.status) &&
    typeof candidate.legacyNeedsPrepare === "boolean"
  );
}

function migrateLegacy(value: unknown, chapterId: string): GeminiQueueState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.chapterId !== "string" ||
    candidate.chapterId !== chapterId ||
    !isStringArray(candidate.beatIds) ||
    !isStringArray(candidate.completedBeatIds) ||
    !isStringArray(candidate.skippedBeatIds) ||
    typeof candidate.currentIndex !== "number" ||
    !Number.isInteger(candidate.currentIndex) ||
    !isQueueStatus(candidate.status)
  ) {
    return null;
  }
  return migrateLegacyGeminiQueue({
    chapterId,
    beatIds: candidate.beatIds,
    completedBeatIds: candidate.completedBeatIds,
    skippedBeatIds: candidate.skippedBeatIds,
    currentIndex: candidate.currentIndex,
    status: candidate.status as GeminiQueueState["status"],
  });
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
    if (isGeminiQueueState(parsed) && parsed.chapterId === chapterId) return parsed;
    return migrateLegacy(parsed, chapterId);
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
