export interface GeminiGenerationSnapshot {
  generatedImageCount: number;
  imageSources: readonly string[];
}

export function hasCompletedGeminiGeneration(
  baseline: GeminiGenerationSnapshot,
  current: GeminiGenerationSnapshot,
): boolean {
  if (current.generatedImageCount <= baseline.generatedImageCount) return false;
  return current.imageSources
    .slice(baseline.generatedImageCount)
    .some((source) => source.trim().length > 0);
}
