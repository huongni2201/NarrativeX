const MAX_VOICE_AUDIO_BYTES = 50 * 1024 * 1024;

export interface VoiceAudioSelection {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  durationMs?: number;
}

export interface PersistVoiceAudioAssetDeps {
  registerLocal(input: {
    projectId: string;
    type: "AUDIO";
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256: string;
    durationMs?: number;
  }): Promise<{ id: string }>;
  commitSelectedAsset(input: {
    projectId: string;
    assetId: string;
    kind: "AUDIO";
    selectionToken: string;
  }): Promise<unknown>;
}

export async function persistVoiceAudioAsset(
  deps: PersistVoiceAudioAssetDeps,
  input: { projectId: string; selection: VoiceAudioSelection },
): Promise<{ assetId: string; selection: VoiceAudioSelection }> {
  if (input.selection.kind !== "AUDIO") {
    throw new Error("Chỉ hỗ trợ file audio trong Voice & TTS.");
  }
  if (input.selection.sizeBytes > MAX_VOICE_AUDIO_BYTES) {
    throw new Error("File audio vượt quá giới hạn 50MB.");
  }

  const asset = await deps.registerLocal({
    projectId: input.projectId,
    type: "AUDIO",
    originalFilename: input.selection.originalFilename,
    contentType: input.selection.contentType,
    sizeBytes: input.selection.sizeBytes,
    checksumSha256: input.selection.checksumSha256,
    durationMs: input.selection.durationMs,
  });

  await deps.commitSelectedAsset({
    projectId: input.projectId,
    assetId: asset.id,
    kind: "AUDIO",
    selectionToken: input.selection.selectionToken,
  });

  return { assetId: asset.id, selection: input.selection };
}
