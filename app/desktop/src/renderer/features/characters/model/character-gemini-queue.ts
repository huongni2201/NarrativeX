export type CharacterGeminiQueueStatus = "RUNNING" | "PAUSED" | "COMPLETED";

export interface CharacterGeminiQueueState {
  projectId: string;
  characterIds: string[];
  completedCharacterIds: string[];
  skippedCharacterIds: string[];
  currentIndex: number;
  status: CharacterGeminiQueueStatus;
}

type QueueCharacter = { id: string };

function uniqueIds(ids: readonly string[]) {
  return [...new Set(ids)];
}

function nextPendingIndex(
  state: Pick<CharacterGeminiQueueState, "characterIds" | "completedCharacterIds" | "skippedCharacterIds">,
) {
  const handledIds = new Set([...state.completedCharacterIds, ...state.skippedCharacterIds]);
  const nextIndex = state.characterIds.findIndex((characterId) => !handledIds.has(characterId));
  return nextIndex >= 0 ? nextIndex : state.characterIds.length;
}

function withProgress(
  state: CharacterGeminiQueueState,
  completedCharacterIds: string[],
  skippedCharacterIds: string[],
): CharacterGeminiQueueState {
  const nextState = {
    ...state,
    completedCharacterIds: uniqueIds(completedCharacterIds),
    skippedCharacterIds: uniqueIds(skippedCharacterIds),
  };
  const currentIndex = nextPendingIndex(nextState);
  return {
    ...nextState,
    currentIndex,
    status: currentIndex >= nextState.characterIds.length ? "COMPLETED" : state.status,
  };
}

export function createCharacterGeminiQueue(
  projectId: string,
  characters: readonly QueueCharacter[],
): CharacterGeminiQueueState | null {
  const characterIds = uniqueIds(characters.map((character) => character.id));
  if (!characterIds.length) return null;
  return {
    projectId,
    characterIds,
    completedCharacterIds: [],
    skippedCharacterIds: [],
    currentIndex: 0,
    status: "RUNNING",
  };
}

export function restoreCharacterQueueForSession(
  state: CharacterGeminiQueueState,
): CharacterGeminiQueueState {
  return state.status === "RUNNING" ? { ...state, status: "PAUSED" } : state;
}

export function reconcileCharacterQueue(
  state: CharacterGeminiQueueState,
  validCharacterIds: ReadonlySet<string>,
): CharacterGeminiQueueState | null {
  const characterIds = state.characterIds.filter((id) => validCharacterIds.has(id));
  if (!characterIds.length) return null;
  if (characterIds.length === state.characterIds.length) return state;

  const completedCharacterIds = state.completedCharacterIds.filter((id) => validCharacterIds.has(id));
  const skippedCharacterIds = state.skippedCharacterIds.filter((id) => validCharacterIds.has(id));
  const reconciled = { ...state, characterIds, completedCharacterIds, skippedCharacterIds };
  const currentIndex = nextPendingIndex(reconciled);
  return {
    ...reconciled,
    currentIndex,
    status: currentIndex >= characterIds.length ? "COMPLETED" : "PAUSED",
  };
}

export function markCharacterQueueCompleted(
  state: CharacterGeminiQueueState,
  characterId: string,
): CharacterGeminiQueueState {
  return withProgress(state, [...state.completedCharacterIds, characterId], state.skippedCharacterIds);
}

export function markCharacterQueueSkipped(
  state: CharacterGeminiQueueState,
  characterId: string,
): CharacterGeminiQueueState {
  return withProgress(state, state.completedCharacterIds, [...state.skippedCharacterIds, characterId]);
}
