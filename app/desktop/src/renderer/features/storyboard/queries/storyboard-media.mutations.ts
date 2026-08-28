export type StoryboardImageSource = "GEMINI_WEB" | "MANUAL";

export interface StoryboardImageSelection {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
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

  return asset.id;
}

export interface GeminiStoryboardReference {
  refLabel: string;
  assetId: string;
  characterId: string;
  canonicalName: string;
  beatRole: string | null;
}

export interface GeminiStoryboardContext {
  prompt: string;
  references: GeminiStoryboardReference[];
}

export interface GenerateGeminiStoryboardImageDeps {
  getGeminiContext(
    projectId: string,
    chapterId: string,
    beatId: string,
  ): Promise<GeminiStoryboardContext>;
  materializeRemoteAsset(input: { projectId: string; assetId: string }): Promise<unknown>;
  generateImage(input: {
    prompt: string;
    projectId: string;
    references: GeminiStoryboardReference[];
  }): Promise<StoryboardImageSelection>;
  persistImage(input: PersistStoryboardImageInput): Promise<string>;
}

export interface GenerateGeminiStoryboardImageInput {
  projectId: string;
  chapterId: string;
  beat: {
    id: string;
    sceneId: string;
    rowVersion: number;
  };
  hasProductionTimelineBeat: boolean;
  materializedReferenceIds: Set<string>;
}

export async function generateGeminiStoryboardImage(
  deps: GenerateGeminiStoryboardImageDeps,
  input: GenerateGeminiStoryboardImageInput,
) {
  const context = await deps.getGeminiContext(
    input.projectId,
    input.chapterId,
    input.beat.id,
  );
  if (!context.prompt.trim()) {
    throw new Error("Backend chưa trả Gemini prompt cho Visual Beat này.");
  }

  for (const reference of context.references) {
    if (input.materializedReferenceIds.has(reference.assetId)) continue;
    await deps.materializeRemoteAsset({
      projectId: input.projectId,
      assetId: reference.assetId,
    });
    input.materializedReferenceIds.add(reference.assetId);
  }

  const references = context.references.map((reference) => ({
    refLabel: reference.refLabel,
    assetId: reference.assetId,
    characterId: reference.characterId,
    canonicalName: reference.canonicalName,
    beatRole: reference.beatRole,
  }));
  const selection = await deps.generateImage({
    prompt: context.prompt,
    projectId: input.projectId,
    references,
  });
  const assetId = await deps.persistImage({
    projectId: input.projectId,
    chapterId: input.chapterId,
    sceneId: input.beat.sceneId,
    beatId: input.beat.id,
    beatRowVersion: input.beat.rowVersion,
    hasProductionTimelineBeat: input.hasProductionTimelineBeat,
    selection,
    source: "GEMINI_WEB",
  });

  return {
    assetId,
    referenceCount: references.length,
  };
}
