export type GeminiQueueStatus = "RUNNING" | "PAUSED" | "COMPLETED";

export interface GeminiQueueState {
  chapterId: string;
  beatIds: string[];
  completedBeatIds: string[];
  skippedBeatIds: string[];
  currentIndex: number;
  status: GeminiQueueStatus;
}

type GeminiQueueBeat = {
  id: string;
  reviewStatus: "NEEDS_REVIEW" | "APPROVED";
};

export function createGeminiQueue(
  chapterId: string,
  beats: readonly GeminiQueueBeat[],
): GeminiQueueState | null {
  const beatIds = beats
    .filter((beat) => beat.reviewStatus !== "APPROVED")
    .map((beat) => beat.id);
  if (!beatIds.length) return null;
  return {
    chapterId,
    beatIds,
    completedBeatIds: [],
    skippedBeatIds: [],
    currentIndex: 0,
    status: "RUNNING",
  };
}

export function skipQueueBeatIfApproved(
  state: GeminiQueueState,
  beat: GeminiQueueBeat,
): GeminiQueueState {
  return beat.reviewStatus === "APPROVED"
    ? markQueueBeatSkipped(state, beat.id)
    : state;
}

function uniqueIds(ids: readonly string[]) {
  return [...new Set(ids)];
}

function nextPendingIndex(
  state: Pick<GeminiQueueState, "beatIds" | "completedBeatIds" | "skippedBeatIds">,
) {
  const handledBeatIds = new Set([...state.completedBeatIds, ...state.skippedBeatIds]);
  const nextIndex = state.beatIds.findIndex((beatId) => !handledBeatIds.has(beatId));
  return nextIndex >= 0 ? nextIndex : state.beatIds.length;
}

function withProgress(
  state: GeminiQueueState,
  completedBeatIds: string[],
  skippedBeatIds: string[],
): GeminiQueueState {
  const nextState: GeminiQueueState = {
    ...state,
    completedBeatIds: uniqueIds(completedBeatIds),
    skippedBeatIds: uniqueIds(skippedBeatIds),
  };
  const currentIndex = nextPendingIndex(nextState);

  return {
    ...nextState,
    currentIndex,
    status: currentIndex >= nextState.beatIds.length ? "COMPLETED" : state.status,
  };
}

export function restoreQueueForSession(state: GeminiQueueState): GeminiQueueState {
  return state.status === "RUNNING" ? { ...state, status: "PAUSED" } : state;
}

export function reconcileQueue(
  state: GeminiQueueState,
  validBeatIds: ReadonlySet<string>,
): GeminiQueueState | null {
  const beatIds = state.beatIds.filter((beatId) => validBeatIds.has(beatId));
  if (!beatIds.length) return null;
  if (beatIds.length === state.beatIds.length) return state;

  const completedBeatIds = state.completedBeatIds.filter((beatId) => validBeatIds.has(beatId));
  const skippedBeatIds = state.skippedBeatIds.filter((beatId) => validBeatIds.has(beatId));
  const reconciled: GeminiQueueState = {
    ...state,
    beatIds,
    completedBeatIds,
    skippedBeatIds,
  };
  const currentIndex = nextPendingIndex(reconciled);

  return {
    ...reconciled,
    currentIndex,
    status: currentIndex >= beatIds.length ? "COMPLETED" : "PAUSED",
  };
}

export function markQueueBeatCompleted(
  state: GeminiQueueState,
  beatId: string,
): GeminiQueueState {
  return withProgress(state, [...state.completedBeatIds, beatId], state.skippedBeatIds);
}

export function markQueueBeatSkipped(
  state: GeminiQueueState,
  beatId: string,
): GeminiQueueState {
  return withProgress(state, state.completedBeatIds, [...state.skippedBeatIds, beatId]);
}
