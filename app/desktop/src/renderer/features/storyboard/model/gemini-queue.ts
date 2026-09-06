import type { StoryboardGenerationBatch } from "@narrativex/client-contracts";

export type GeminiQueueStatus = "RUNNING" | "PAUSED" | "COMPLETED";
export type GeminiQueueGenerationErrorAction = "SKIP_BEAT" | "PAUSE_QUEUE";
export type GeminiQueueAttemptStage =
  | "PREPARED"
  | "SUBMITTING"
  | "UNKNOWN"
  | "COMPLETED"
  | "FAILED";

export interface GeminiQueueAttempt {
  attemptId: string;
  snapshotId: string;
  inputFingerprint: string;
  stage: GeminiQueueAttemptStage;
}

export interface GeminiQueueState {
  schemaVersion: 2;
  chapterId: string;
  batchId: string | null;
  batchFingerprint: string | null;
  storyboardRevisionId: string | null;
  sourceHash: string | null;
  beatIds: string[];
  snapshotIdsByBeat: Record<string, string>;
  completedBeatIds: string[];
  skippedBeatIds: string[];
  attemptsByBeat: Record<string, GeminiQueueAttempt>;
  currentIndex: number;
  status: GeminiQueueStatus;
  legacyNeedsPrepare: boolean;
}

type GeminiQueueBeat = {
  id: string;
  reviewStatus: "NEEDS_REVIEW" | "APPROVED";
  previewMediaAssetId: string | null;
};

export function createGeminiQueue(
  chapterId: string,
  batch: StoryboardGenerationBatch,
): GeminiQueueState | null {
  const beatIds = batch.beats.map((beat) => beat.visualBeatId);
  if (!beatIds.length) return null;
  return {
    schemaVersion: 2,
    chapterId,
    batchId: batch.batchId,
    batchFingerprint: batch.requestFingerprint,
    storyboardRevisionId: batch.storyboardRevisionId,
    sourceHash: batch.sourceHash,
    beatIds,
    snapshotIdsByBeat: Object.fromEntries(
      batch.beats.map((beat) => [beat.visualBeatId, beat.snapshotId]),
    ),
    completedBeatIds: [],
    skippedBeatIds: [],
    attemptsByBeat: {},
    currentIndex: 0,
    status: "RUNNING",
    legacyNeedsPrepare: false,
  };
}

export function migrateLegacyGeminiQueue(input: {
  chapterId: string;
  beatIds: string[];
  completedBeatIds: string[];
  skippedBeatIds: string[];
  currentIndex: number;
  status: GeminiQueueStatus;
}): GeminiQueueState {
  return {
    schemaVersion: 2,
    chapterId: input.chapterId,
    batchId: null,
    batchFingerprint: null,
    storyboardRevisionId: null,
    sourceHash: null,
    beatIds: uniqueIds(input.beatIds),
    snapshotIdsByBeat: {},
    completedBeatIds: uniqueIds(input.completedBeatIds),
    skippedBeatIds: uniqueIds(input.skippedBeatIds),
    attemptsByBeat: {},
    currentIndex: input.currentIndex,
    status: input.status === "COMPLETED" ? "COMPLETED" : "PAUSED",
    legacyNeedsPrepare: input.status !== "COMPLETED",
  };
}

export function skipQueueBeatIfMediaReady(
  state: GeminiQueueState,
  beat: GeminiQueueBeat,
): GeminiQueueState {
  return beat.previewMediaAssetId
    ? markQueueBeatSkipped(state, beat.id)
    : state;
}

export function classifyGeminiQueueGenerationError(
  error: unknown,
): GeminiQueueGenerationErrorAction {
  const text = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error ?? "");
  return text.includes("GEMINI_GENERATION_REJECTED") ? "SKIP_BEAT" : "PAUSE_QUEUE";
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
  const attemptsByBeat = Object.fromEntries(
    Object.entries(state.attemptsByBeat).map(([beatId, attempt]) => [
      beatId,
      attempt.stage === "SUBMITTING" ? { ...attempt, stage: "UNKNOWN" as const } : attempt,
    ]),
  );
  return state.status === "RUNNING" || attemptsByBeat !== state.attemptsByBeat
    ? { ...state, attemptsByBeat, status: state.status === "COMPLETED" ? "COMPLETED" : "PAUSED" }
    : state;
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
  const snapshotIdsByBeat = Object.fromEntries(
    Object.entries(state.snapshotIdsByBeat).filter(([beatId]) => validBeatIds.has(beatId)),
  );
  const attemptsByBeat = Object.fromEntries(
    Object.entries(state.attemptsByBeat).filter(([beatId]) => validBeatIds.has(beatId)),
  );
  const reconciled: GeminiQueueState = {
    ...state,
    beatIds,
    completedBeatIds,
    skippedBeatIds,
    snapshotIdsByBeat,
    attemptsByBeat,
  };
  const currentIndex = nextPendingIndex(reconciled);

  return {
    ...reconciled,
    currentIndex,
    status: currentIndex >= beatIds.length ? "COMPLETED" : "PAUSED",
  };
}

export function beginQueueAttempt(
  state: GeminiQueueState,
  beatId: string,
  attempt: GeminiQueueAttempt,
): GeminiQueueState {
  const existing = state.attemptsByBeat[beatId];
  if (existing && existing.stage !== "FAILED") {
    throw new Error(`Gemini beat ${beatId} already has an unresolved or completed attempt.`);
  }
  return {
    ...state,
    attemptsByBeat: {
      ...state.attemptsByBeat,
      [beatId]: attempt,
    },
  };
}

export function markQueueAttemptStage(
  state: GeminiQueueState,
  beatId: string,
  stage: GeminiQueueAttemptStage,
): GeminiQueueState {
  const attempt = state.attemptsByBeat[beatId];
  if (!attempt) return state;
  return {
    ...state,
    attemptsByBeat: {
      ...state.attemptsByBeat,
      [beatId]: { ...attempt, stage },
    },
  };
}

export function markQueueBeatCompleted(
  state: GeminiQueueState,
  beatId: string,
): GeminiQueueState {
  const withAttempt = markQueueAttemptStage(state, beatId, "COMPLETED");
  return withProgress(withAttempt, [...withAttempt.completedBeatIds, beatId], withAttempt.skippedBeatIds);
}

export function markQueueBeatSkipped(
  state: GeminiQueueState,
  beatId: string,
): GeminiQueueState {
  const withAttempt = markQueueAttemptStage(state, beatId, "FAILED");
  return withProgress(withAttempt, withAttempt.completedBeatIds, [...withAttempt.skippedBeatIds, beatId]);
}

export function unresolvedAttemptBeatIds(state: GeminiQueueState): string[] {
  return Object.entries(state.attemptsByBeat)
    .filter(([, attempt]) => attempt.stage === "SUBMITTING" || attempt.stage === "UNKNOWN")
    .map(([beatId]) => beatId);
}
