import type {
  StoryboardGenerationBatch,
  StoryboardGenerationBeatSnapshot,
  StoryboardGenerationReference,
} from "@narrativex/client-contracts";
import { GeminiReferenceMaterializer } from "../model/gemini-reference-materializer.ts";

export type StoryboardImageSource = "GEMINI_WEB" | "MANUAL";

export interface StoryboardImageSelection {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  generationAttemptId?: string;
  generationInputFingerprint?: string;
}

export interface StoryboardImageRegistration {
  projectId: string;
  type: "IMAGE";
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  durationMs: null;
}

export interface PersistStoryboardImageDeps {
  registerLocal(input: StoryboardImageRegistration): Promise<{ id: string }>;
  commitGeminiImage(input: {
    lane: "STORYBOARD";
    projectId: string;
    assetId: string;
    selectionToken: string;
  }): Promise<unknown>;
  commitSelectedAsset(input: {
    projectId: string;
    assetId: string;
    kind: "IMAGE";
    selectionToken: string;
  }): Promise<unknown>;
  attachBeatPreview(
    projectId: string,
    chapterId: string,
    sceneId: string,
    beatId: string,
    beatRowVersion: number,
    mediaAssetId: string,
  ): Promise<unknown>;
  updateBeatMedia(
    projectId: string,
    beatId: string,
    input: { mediaAssetId: string; fitMode: "TRIM"; trimStartMs: 0 },
  ): Promise<unknown>;
}

export interface PersistStoryboardImageInput {
  projectId: string;
  chapterId: string;
  sceneId: string;
  beatId: string;
  beatRowVersion: number;
  hasProductionTimelineBeat: boolean;
  selection: StoryboardImageSelection;
  source: StoryboardImageSource;
  attachToBeat?: boolean;
}

export async function persistStoryboardImage(
  deps: PersistStoryboardImageDeps,
  input: PersistStoryboardImageInput,
) {
  if (input.selection.kind !== "IMAGE") {
    throw new Error("Generated image flow chỉ chấp nhận file ảnh.");
  }

  const asset = await deps.registerLocal({
    projectId: input.projectId,
    type: "IMAGE",
    originalFilename: input.selection.originalFilename,
    contentType: input.selection.contentType,
    sizeBytes: input.selection.sizeBytes,
    checksumSha256: input.selection.checksumSha256,
    durationMs: null,
  });

  if (input.source === "GEMINI_WEB") {
    await deps.commitGeminiImage({
      lane: "STORYBOARD",
      projectId: input.projectId,
      assetId: asset.id,
      selectionToken: input.selection.selectionToken,
    });
  } else {
    await deps.commitSelectedAsset({
      projectId: input.projectId,
      assetId: asset.id,
      kind: "IMAGE",
      selectionToken: input.selection.selectionToken,
    });
  }

  if (input.attachToBeat !== false) {
    await deps.attachBeatPreview(
      input.projectId,
      input.chapterId,
      input.sceneId,
      input.beatId,
      input.beatRowVersion,
      asset.id,
    );

    if (input.hasProductionTimelineBeat) {
      await deps.updateBeatMedia(input.projectId, input.beatId, {
        mediaAssetId: asset.id,
        fitMode: "TRIM",
        trimStartMs: 0,
      });
    }
  }

  return asset.id;
}

export interface GenerateGeminiStoryboardImageDeps {
  getPreparedBatch(
    projectId: string,
    chapterId: string,
    batchId: string,
  ): Promise<StoryboardGenerationBatch>;
  materializeRemoteAsset(input: { projectId: string; assetId: string }): Promise<{ checksumSha256: string }>;
  generateImage(input: {
    lane: "STORYBOARD";
    prompt: string;
    projectId: string;
    references: StoryboardGenerationReference[];
    provenance: {
      attemptId: string;
      batchId: string;
      snapshotId: string;
      batchFingerprint: string;
      inputFingerprint: string;
      stylePolicyVersion: string;
      providerPolicyVersion: string;
    };
  }): Promise<StoryboardImageSelection>;
  persistImage(input: PersistStoryboardImageInput): Promise<string>;
}

export interface GenerateGeminiStoryboardImageInput {
  projectId: string;
  chapterId: string;
  batch: Pick<
    StoryboardGenerationBatch,
    "batchId" | "requestFingerprint" | "stylePolicyVersion" | "providerPolicyVersion"
  >;
  snapshot: StoryboardGenerationBeatSnapshot;
  attemptId: string;
  hasProductionTimelineBeat: boolean;
  referenceMaterializer: GeminiReferenceMaterializer;
}

export async function generateGeminiStoryboardImage(
  deps: GenerateGeminiStoryboardImageDeps,
  input: GenerateGeminiStoryboardImageInput,
) {
  const currentBatch = await deps.getPreparedBatch(
    input.projectId,
    input.chapterId,
    input.batch.batchId,
  );
  if (currentBatch.stale) {
    throw new Error("STALE_GENERATION_INPUT: prepared Gemini batch no longer matches the current storyboard/source revision.");
  }
  if (currentBatch.requestFingerprint !== input.batch.requestFingerprint) {
    throw new Error("STALE_GENERATION_INPUT: prepared Gemini batch fingerprint changed unexpectedly.");
  }
  const authoritativeSnapshot = currentBatch.beats.find(
    (beat) => beat.snapshotId === input.snapshot.snapshotId,
  );
  if (
    !authoritativeSnapshot ||
    authoritativeSnapshot.visualBeatId !== input.snapshot.visualBeatId ||
    authoritativeSnapshot.inputFingerprint !== input.snapshot.inputFingerprint
  ) {
    throw new Error("STALE_GENERATION_INPUT: Visual Beat snapshot is not part of the prepared batch.");
  }
  if (!authoritativeSnapshot.prompt.trim()) {
    throw new Error("Backend chưa trả Gemini prompt cho Visual Beat snapshot này.");
  }

  for (const reference of authoritativeSnapshot.references) {
    if (!reference.sha256) {
      throw new Error(`REFERENCE_INTEGRITY_FAILED: ${reference.refLabel} is missing a checksum.`);
    }
    await input.referenceMaterializer.materialize(
      {
        projectId: input.projectId,
        assetId: reference.assetId,
        expectedChecksumSha256: reference.sha256,
      },
      deps.materializeRemoteAsset,
    );
  }

  const selection = await deps.generateImage({
    lane: "STORYBOARD",
    prompt: authoritativeSnapshot.prompt,
    projectId: input.projectId,
    references: authoritativeSnapshot.references,
    provenance: {
      attemptId: input.attemptId,
      batchId: currentBatch.batchId,
      snapshotId: authoritativeSnapshot.snapshotId,
      batchFingerprint: currentBatch.requestFingerprint,
      inputFingerprint: authoritativeSnapshot.inputFingerprint,
      stylePolicyVersion: currentBatch.stylePolicyVersion,
      providerPolicyVersion: currentBatch.providerPolicyVersion,
    },
  });
  if (
    selection.generationAttemptId !== input.attemptId ||
    selection.generationInputFingerprint !== authoritativeSnapshot.inputFingerprint
  ) {
    throw new Error("GEMINI_OUTPUT_PROVENANCE_MISMATCH: generated output is not bound to the expected attempt snapshot.");
  }

  const postGenerationBatch = await deps.getPreparedBatch(
    input.projectId,
    input.chapterId,
    currentBatch.batchId,
  );
  const staleAfterGeneration =
    postGenerationBatch.stale ||
    postGenerationBatch.requestFingerprint !== currentBatch.requestFingerprint;
  const assetId = await deps.persistImage({
    projectId: input.projectId,
    chapterId: input.chapterId,
    sceneId: authoritativeSnapshot.sceneId,
    beatId: authoritativeSnapshot.visualBeatId,
    beatRowVersion: authoritativeSnapshot.beatRowVersion,
    hasProductionTimelineBeat: input.hasProductionTimelineBeat,
    selection,
    source: "GEMINI_WEB",
    attachToBeat: !staleAfterGeneration,
  });
  if (staleAfterGeneration) {
    throw new Error(
      `STALE_GENERATION_INPUT_OUTPUT_RETAINED: generated asset ${assetId} was kept for review but not attached to the changed storyboard revision.`,
    );
  }

  return {
    assetId,
    attemptId: input.attemptId,
    snapshotId: authoritativeSnapshot.snapshotId,
    inputFingerprint: authoritativeSnapshot.inputFingerprint,
    referenceCount: authoritativeSnapshot.references.length,
  };
}
