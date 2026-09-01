import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DesktopCharacter } from "@narrativex/client-contracts";
import { runBoundedParallel } from "../../../shared/bounded-parallel";
import { charactersApi } from "../api/characters.api";
import {
  createCharacterGeminiQueue,
  markCharacterQueueCompleted,
  markCharacterQueueSkipped,
  reconcileCharacterQueue,
  restoreCharacterQueueForSession,
  type CharacterGeminiQueueState,
} from "../model/character-gemini-queue";
import { generateCharacterIdentityReference } from "../services/character-reference-generation";
import {
  loadCharacterGeminiQueue,
  saveCharacterGeminiQueue,
} from "../store/character-gemini-queue.persistence";

type QueueGenerationResult = "generated" | "skipped" | "failed";

interface CharacterGeminiQueueCallbacks {
  onNotice: (notice: string) => void;
  onSelectCharacter: (characterId: string) => void;
}

function normalizeLabel(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "—";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useCharacterGeminiQueue(
  projectId: string,
  characters: DesktopCharacter[],
  callbacks: CharacterGeminiQueueCallbacks,
) {
  const queryClient = useQueryClient();
  const [geminiQueue, setGeminiQueue] = useState<CharacterGeminiQueueState | null>(null);
  const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null);
  const activeCharacterIdsRef = useRef(new Set<string>());
  const geminiRunTokenRef = useRef(0);
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  );

  const publishGeminiQueue = useCallback(
    (next: CharacterGeminiQueueState | null) => {
      setGeminiQueue(next);
      saveCharacterGeminiQueue(projectId, next);
    },
    [projectId],
  );

  useEffect(() => {
    const restored = loadCharacterGeminiQueue(projectId);
    publishGeminiQueue(restored ? restoreCharacterQueueForSession(restored) : null);
  }, [projectId, publishGeminiQueue]);

  useEffect(() => {
    if (!geminiQueue || geminiQueue.status === "COMPLETED") return;
    const reconciled = reconcileCharacterQueue(
      geminiQueue,
      new Set(characters.map((character) => character.id)),
    );
    if (reconciled !== geminiQueue) publishGeminiQueue(reconciled);
  }, [characters, geminiQueue, publishGeminiQueue]);

  const currentQueueCharacterId = geminiQueue?.characterIds[geminiQueue.currentIndex] ?? null;
  const currentQueueCharacter = currentQueueCharacterId
    ? characterById.get(currentQueueCharacterId) ?? null
    : null;
  const queueProcessedCount = geminiQueue
    ? geminiQueue.completedCharacterIds.length + geminiQueue.skippedCharacterIds.length
    : 0;
  const geminiQueueActive = Boolean(geminiQueue && geminiQueue.status !== "COMPLETED");

  useEffect(() => {
    if (currentQueueCharacterId && geminiQueueActive) {
      callbacks.onSelectCharacter(currentQueueCharacterId);
    }
  }, [callbacks, currentQueueCharacterId, geminiQueueActive]);

  async function refreshCharacter(characterId: string, versionId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "characters"] }),
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "characters", characterId] }),
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "characters", characterId, "versions", versionId, "references"],
      }),
    ]);
  }

  function publishActiveCharacter() {
    setGeneratingCharacterId(activeCharacterIdsRef.current.values().next().value ?? null);
  }

  async function generateCharacterIdentity(characterId: string): Promise<QueueGenerationResult> {
    if (activeCharacterIdsRef.current.has(characterId)) return "failed";
    activeCharacterIdsRef.current.add(characterId);
    publishActiveCharacter();
    callbacks.onSelectCharacter(characterId);
    try {
      const character = await charactersApi.detail(projectId, characterId);
      const version = character.version;
      if (!version?.id) {
        callbacks.onNotice(`Character All · Skip “${character.canonicalName}”: chưa có character version.`);
        return "skipped";
      }
      const references = await charactersApi.versionReferences(characterId, version.id);
      if (references.some((reference) => reference.role.toUpperCase() === "IDENTITY")) {
        callbacks.onNotice(`Character All · Skip “${character.canonicalName}”: đã có IDENTITY reference.`);
        return "skipped";
      }
      if (version.status === "REVIEW" || version.status === "LOCKED") {
        callbacks.onNotice(
          `Character All · Skip “${character.canonicalName}”: version đang ${normalizeLabel(version.status)}.`,
        );
        return "skipped";
      }
      const prompt = version.prompt?.trim() ?? "";
      if (!prompt) {
        callbacks.onNotice(
          `Character All tạm dừng tại “${character.canonicalName}”: backend chưa trả generation prompt.`,
        );
        return "failed";
      }
      callbacks.onNotice(`Character All · Đang generate IDENTITY cho “${character.canonicalName}”…`);
      await generateCharacterIdentityReference({ projectId, characterId, versionId: version.id, prompt });
      await refreshCharacter(characterId, version.id);
      callbacks.onNotice(`Character All · Đã generate IDENTITY cho “${character.canonicalName}”.`);
      return "generated";
    } catch (error) {
      callbacks.onNotice(errorMessage(error, "Không thể generate character identity reference."));
      return "failed";
    } finally {
      activeCharacterIdsRef.current.delete(characterId);
      publishActiveCharacter();
    }
  }

  async function characterConcurrency(): Promise<number> {
    try {
      return (await window.narrativex.preferences.get()).gemini.characterTabs;
    } catch {
      return 2;
    }
  }

  async function runGeminiQueue(initialQueue: CharacterGeminiQueueState, runToken: number) {
    let queue: CharacterGeminiQueueState = { ...initialQueue, status: "RUNNING" };
    const processed = new Set([...queue.completedCharacterIds, ...queue.skippedCharacterIds]);
    const pendingIds = queue.characterIds.filter((characterId) => !processed.has(characterId));
    let acceptNewWork = true;
    const concurrency = await characterConcurrency();

    await runBoundedParallel(
      pendingIds,
      concurrency,
      async (characterId) => {
        if (runToken !== geminiRunTokenRef.current || !acceptNewWork) return;
        if (!characterById.has(characterId)) {
          processed.add(characterId);
          queue = markCharacterQueueSkipped(queue, characterId);
          publishGeminiQueue(queue);
          return;
        }

        const result = await generateCharacterIdentity(characterId);
        if (runToken !== geminiRunTokenRef.current) return;
        if (result === "generated") {
          processed.add(characterId);
          queue = markCharacterQueueCompleted(queue, characterId);
          publishGeminiQueue(queue);
          return;
        }
        if (result === "skipped") {
          processed.add(characterId);
          queue = markCharacterQueueSkipped(queue, characterId);
          publishGeminiQueue(queue);
          return;
        }
        acceptNewWork = false;
      },
      () => runToken === geminiRunTokenRef.current && acceptNewWork,
    );

    if (runToken !== geminiRunTokenRef.current) return;
    if (!acceptNewWork) {
      publishGeminiQueue({ ...queue, status: "PAUSED" });
      return;
    }
    const completedQueue: CharacterGeminiQueueState = {
      ...queue,
      currentIndex: queue.characterIds.length,
      status: "COMPLETED",
    };
    publishGeminiQueue(completedQueue);
    callbacks.onNotice(
      `Character All hoàn tất: ${completedQueue.completedCharacterIds.length} generated, ${completedQueue.skippedCharacterIds.length} skipped.`,
    );
  }

  async function startGeminiAll() {
    const queue = createCharacterGeminiQueue(projectId, characters);
    if (!queue) return;
    publishGeminiQueue(queue);
    await runGeminiQueue(queue, ++geminiRunTokenRef.current);
  }

  async function resumeGeminiAll() {
    if (!geminiQueue || geminiQueue.status === "COMPLETED") return;
    const resumed = { ...geminiQueue, status: "RUNNING" as const };
    publishGeminiQueue(resumed);
    await runGeminiQueue(resumed, ++geminiRunTokenRef.current);
  }

  async function skipCurrentGeminiCharacter() {
    if (!geminiQueue || !currentQueueCharacterId || geminiQueue.status === "COMPLETED") return;
    const skipped = markCharacterQueueSkipped(geminiQueue, currentQueueCharacterId);
    publishGeminiQueue(skipped);
    if (skipped.status === "COMPLETED") return;
    const resumed = { ...skipped, status: "RUNNING" as const };
    publishGeminiQueue(resumed);
    await runGeminiQueue(resumed, ++geminiRunTokenRef.current);
  }

  function stopGeminiAll() {
    geminiRunTokenRef.current += 1;
    if (geminiQueue && geminiQueue.status !== "COMPLETED") {
      publishGeminiQueue({ ...geminiQueue, status: "PAUSED" });
    }
    callbacks.onNotice(
      "Đã dừng Character All. Các tab đang generate sẽ hoàn tất nhưng không nhận character mới.",
    );
  }

  return {
    geminiQueue,
    generatingCharacterId,
    currentQueueCharacter,
    queueProcessedCount,
    geminiQueueActive,
    startGeminiAll,
    resumeGeminiAll,
    skipCurrentGeminiCharacter,
    stopGeminiAll,
    dismissGeminiQueue: () => publishGeminiQueue(null),
  };
}
