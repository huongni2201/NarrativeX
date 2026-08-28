import type { BeatMediaFitMode } from "@narrativex/client-contracts";
import { chooseMediaFit } from "../../production/auto-edit-planner.ts";

export type EditorMediaKind = "IMAGE" | "VIDEO";

export interface EditorMediaSelection {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  durationMs: number | null;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
}

export interface EditorRegisteredMedia {
  id: string;
  originalFilename: string;
  durationMs: number | null;
}

export interface EditorMediaAttachInput {
  beatId: string;
  mediaAssetId: string;
  fitMode: BeatMediaFitMode;
  trimStartMs: number;
}

export interface PersistEditorMediaDeps {
  registerLocal(input: {
    projectId: string;
    type: EditorMediaKind;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256: string;
    durationMs: number | null;
  }): Promise<EditorRegisteredMedia>;
  commitSelectedAsset(input: {
    projectId: string;
    assetId: string;
    kind: EditorMediaKind;
    selectionToken: string;
  }): Promise<unknown>;
  updateBeatMedia(
    projectId: string,
    beatId: string,
    input: {
      mediaAssetId: string;
      fitMode: BeatMediaFitMode;
      trimStartMs: number;
    },
  ): Promise<unknown>;
}

export interface PersistEditorMediaInput {
  projectId: string;
  beatId: string;
  beatDurationMs: number;
  selection: EditorMediaSelection;
  expectedType?: EditorMediaKind;
}

export class EditorMediaAttachError extends Error {
  readonly retryInput: EditorMediaAttachInput;

  constructor(message: string, retryInput: EditorMediaAttachInput, options?: ErrorOptions) {
    super(message, options);
    this.name = "EditorMediaAttachError";
    this.retryInput = retryInput;
  }
}

export function validateEditorMediaSelection(
  selection: EditorMediaSelection,
  expectedType?: EditorMediaKind,
): asserts selection is EditorMediaSelection & { kind: EditorMediaKind } {
  if (selection.kind !== "IMAGE" && selection.kind !== "VIDEO") {
    throw new Error("Hãy chọn một file ảnh hoặc video.");
  }
  if (expectedType && selection.kind !== expectedType) {
    throw new Error(expectedType === "VIDEO" ? "Hãy chọn một file video." : "Hãy chọn một file ảnh.");
  }
}

export function createEditorMediaAttachInput(
  beatId: string,
  beatDurationMs: number,
  mediaAssetId: string,
  mediaType: EditorMediaKind,
  sourceDurationMs: number | null,
): EditorMediaAttachInput {
  const fit = chooseMediaFit({
    mediaType,
    sourceDurationMs,
    durationMs: beatDurationMs,
  });
  return {
    beatId,
    mediaAssetId,
    fitMode: fit.fitMode,
    trimStartMs: fit.trimStartMs,
  };
}

export async function persistEditorMedia(
  deps: PersistEditorMediaDeps,
  input: PersistEditorMediaInput,
) {
  validateEditorMediaSelection(input.selection, input.expectedType);

  const asset = await deps.registerLocal({
    projectId: input.projectId,
    type: input.selection.kind,
    originalFilename: input.selection.originalFilename,
    contentType: input.selection.contentType,
    sizeBytes: input.selection.sizeBytes,
    checksumSha256: input.selection.checksumSha256,
    durationMs: input.selection.durationMs,
  });

  await deps.commitSelectedAsset({
    projectId: input.projectId,
    assetId: asset.id,
    kind: input.selection.kind,
    selectionToken: input.selection.selectionToken,
  });

  const retryInput = createEditorMediaAttachInput(
    input.beatId,
    input.beatDurationMs,
    asset.id,
    input.selection.kind,
    asset.durationMs,
  );

  try {
    await deps.updateBeatMedia(input.projectId, input.beatId, {
      mediaAssetId: retryInput.mediaAssetId,
      fitMode: retryInput.fitMode,
      trimStartMs: retryInput.trimStartMs,
    });
  } catch (error) {
    throw new EditorMediaAttachError(
      error instanceof Error
        ? `Media đã lưu local nhưng chưa gắn được vào beat: ${error.message}`
        : "Media đã lưu local nhưng chưa gắn được vào beat.",
      retryInput,
      { cause: error },
    );
  }

  return {
    assetId: asset.id,
    originalFilename: asset.originalFilename,
    fitMode: retryInput.fitMode,
    trimStartMs: retryInput.trimStartMs,
  };
}
