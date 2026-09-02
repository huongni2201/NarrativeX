export const ALL_ASSET_CHAPTERS = "ALL";

type AssetWithId = { id: string };
type AssetChapterTimeline = {
  beats: Array<{ chapterId: string; mediaAssetId: string | null }>;
  chapters: Array<{ chapterId: string; narrationAssetId?: string | null }>;
} | null;

export function filterAssetsByChapter<T extends AssetWithId>(
  assets: readonly T[],
  timeline: AssetChapterTimeline,
  chapterId: string,
): T[] {
  if (chapterId === ALL_ASSET_CHAPTERS || !timeline) return [...assets];
  const assetIds = new Set<string>();
  for (const beat of timeline.beats) {
    if (beat.chapterId === chapterId && beat.mediaAssetId) assetIds.add(beat.mediaAssetId);
  }
  const chapter = timeline.chapters.find((item) => item.chapterId === chapterId);
  if (chapter?.narrationAssetId) assetIds.add(chapter.narrationAssetId);
  return assets.filter((asset) => assetIds.has(asset.id));
}
