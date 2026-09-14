export interface StoryboardImageSelection {
  selectionToken: string; originalFilename: string; contentType: string; sizeBytes: number;
  checksumSha256: string; kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
}

export interface PersistStoryboardImageDeps {
  registerLocal(input: { projectId: string; type: "IMAGE"; originalFilename: string; contentType: string; sizeBytes: number; checksumSha256: string; durationMs: null }): Promise<{ id: string }>;
  commitSelectedAsset(input: { projectId: string; assetId: string; kind: "IMAGE"; selectionToken: string }): Promise<unknown>;
  attachBeatPreview(projectId: string, chapterId: string, sceneId: string, beatId: string, beatRowVersion: number, mediaAssetId: string): Promise<unknown>;
  updateBeatMedia(projectId: string, beatId: string, input: { mediaAssetId: string; fitMode: "TRIM"; trimStartMs: 0 }): Promise<unknown>;
}

export async function persistStoryboardImage(deps: PersistStoryboardImageDeps, input: {
  projectId: string; chapterId: string; sceneId: string; beatId: string; beatRowVersion: number;
  hasProductionTimelineBeat: boolean; selection: StoryboardImageSelection;
}) {
  if (input.selection.kind !== "IMAGE") throw new Error("Storyboard chỉ chấp nhận file ảnh.");
  const asset = await deps.registerLocal({ projectId: input.projectId, type: "IMAGE", originalFilename: input.selection.originalFilename, contentType: input.selection.contentType, sizeBytes: input.selection.sizeBytes, checksumSha256: input.selection.checksumSha256, durationMs: null });
  await deps.commitSelectedAsset({ projectId: input.projectId, assetId: asset.id, kind: "IMAGE", selectionToken: input.selection.selectionToken });
  await deps.attachBeatPreview(input.projectId, input.chapterId, input.sceneId, input.beatId, input.beatRowVersion, asset.id);
  if (input.hasProductionTimelineBeat) await deps.updateBeatMedia(input.projectId, input.beatId, { mediaAssetId: asset.id, fitMode: "TRIM", trimStartMs: 0 });
  return asset.id;
}
