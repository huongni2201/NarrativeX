import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url.ts";

interface ChapterNarrationPreviewDeps {
  materializeChapterNarration(input: {
    projectId: string;
    chapterId: string;
    assetId: string;
    sizeBytes: number;
    checksumSha256: string;
  }): Promise<unknown>;
}

export async function materializeChapterNarrationPreview(
  deps: ChapterNarrationPreviewDeps,
  input: Readonly<{
    projectId: string | null;
    chapterId: string | null;
    assetId: string | null;
    sizeBytes: number | null;
    checksumSha256: string | null;
  }>,
): Promise<string | null> {
  if (
    !input.projectId ||
    !input.chapterId ||
    !input.assetId ||
    !input.sizeBytes ||
    !input.checksumSha256
  ) {
    return null;
  }

  await deps.materializeChapterNarration({
    projectId: input.projectId,
    chapterId: input.chapterId,
    assetId: input.assetId,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256,
  });
  return localAssetPreviewUrl(input.projectId, input.assetId);
}
