import type { CharacterGeminiQueueState } from "../model/character-gemini-queue.ts";

export interface CharacterGeminiQueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): CharacterGeminiQueueStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isQueueState(value: unknown): value is CharacterGeminiQueueState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CharacterGeminiQueueState>;
  return (
    typeof candidate.projectId === "string" &&
    isStringArray(candidate.characterIds) &&
    isStringArray(candidate.completedCharacterIds) &&
    isStringArray(candidate.skippedCharacterIds) &&
    typeof candidate.currentIndex === "number" &&
    Number.isInteger(candidate.currentIndex) &&
    candidate.currentIndex >= 0 &&
    (candidate.status === "RUNNING" || candidate.status === "PAUSED" || candidate.status === "COMPLETED")
  );
}

export function characterGeminiQueueStorageKey(projectId: string) {
  return `narrativex:character-gemini-web-queue:${projectId}`;
}

export function loadCharacterGeminiQueue(
  projectId: string,
  storage: CharacterGeminiQueueStorage | null = defaultStorage(),
): CharacterGeminiQueueState | null {
  if (!storage) return null;
  const raw = storage.getItem(characterGeminiQueueStorageKey(projectId));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isQueueState(parsed) && parsed.projectId === projectId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCharacterGeminiQueue(
  projectId: string,
  state: CharacterGeminiQueueState | null,
  storage: CharacterGeminiQueueStorage | null = defaultStorage(),
) {
  if (!storage) return;
  const key = characterGeminiQueueStorageKey(projectId);
  if (!state) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(state));
}
