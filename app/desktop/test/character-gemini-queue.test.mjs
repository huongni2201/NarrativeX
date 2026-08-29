import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createCharacterGeminiQueue,
  markCharacterQueueCompleted,
  markCharacterQueueSkipped,
  reconcileCharacterQueue,
  restoreCharacterQueueForSession,
} from "../src/renderer/features/characters/model/character-gemini-queue.ts";
import {
  characterGeminiQueueStorageKey,
  loadCharacterGeminiQueue,
  saveCharacterGeminiQueue,
} from "../src/renderer/features/characters/store/character-gemini-queue.persistence.ts";

function queue(overrides = {}) {
  return {
    projectId: "project-1",
    characterIds: ["character-1", "character-2", "character-3"],
    completedCharacterIds: [],
    skippedCharacterIds: [],
    currentIndex: 0,
    status: "RUNNING",
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("a running Character Gemini queue restores paused after renderer restart", () => {
  assert.equal(restoreCharacterQueueForSession(queue()).status, "PAUSED");
});

test("a new Character Generate All queue includes every project character once", () => {
  const created = createCharacterGeminiQueue("project-1", [
    { id: "character-1" },
    { id: "character-2" },
    { id: "character-1" },
  ]);

  assert.deepEqual(created, queue({ characterIds: ["character-1", "character-2"] }));
  assert.equal(createCharacterGeminiQueue("project-1", []), null);
});

test("queue reconciliation removes deleted characters and pauses before continuing", () => {
  const reconciled = reconcileCharacterQueue(
    queue({ completedCharacterIds: ["character-1"], currentIndex: 1 }),
    new Set(["character-1", "character-3"]),
  );

  assert.deepEqual(reconciled, {
    projectId: "project-1",
    characterIds: ["character-1", "character-3"],
    completedCharacterIds: ["character-1"],
    skippedCharacterIds: [],
    currentIndex: 1,
    status: "PAUSED",
  });
});

test("queue reconciliation preserves identity when no character changed", () => {
  const state = queue({ status: "PAUSED" });
  assert.equal(reconcileCharacterQueue(state, new Set(state.characterIds)), state);
});

test("completing and skipping characters advance serially and finish the queue", () => {
  const completed = markCharacterQueueCompleted(queue(), "character-1");
  assert.equal(completed.currentIndex, 1);
  assert.deepEqual(completed.completedCharacterIds, ["character-1"]);

  const skipped = markCharacterQueueSkipped(completed, "character-2");
  assert.equal(skipped.currentIndex, 2);
  assert.deepEqual(skipped.skippedCharacterIds, ["character-2"]);

  const finished = markCharacterQueueCompleted(skipped, "character-3");
  assert.equal(finished.currentIndex, 3);
  assert.equal(finished.status, "COMPLETED");
});

test("Character queue persistence is scoped by project and malformed payloads are ignored", () => {
  const storage = memoryStorage();
  const state = queue({ status: "PAUSED" });
  const key = characterGeminiQueueStorageKey("project-1");

  saveCharacterGeminiQueue("project-1", state, storage);
  assert.deepEqual(loadCharacterGeminiQueue("project-1", storage), state);

  storage.setItem(key, "{bad-json");
  assert.equal(loadCharacterGeminiQueue("project-1", storage), null);

  saveCharacterGeminiQueue("project-1", null, storage);
  assert.equal(storage.getItem(key), null);
});

test("Characters screen wires Generate All through the CHARACTER lane service and persists transitions", () => {
  const source = readFileSync(
    "src/renderer/features/characters/screens/CharactersScreen.tsx",
    "utf8",
  );
  assert.match(source, /CharacterGeminiQueueBanner/);
  assert.match(source, /function publishGeminiQueue/);
  assert.match(source, /generateCharacterIdentityReference/);
  assert.match(source, /markCharacterQueueCompleted/);
  assert.match(source, /markCharacterQueueSkipped/);
  assert.match(source, /generationLocked=\{geminiQueueActive\}/);
});
