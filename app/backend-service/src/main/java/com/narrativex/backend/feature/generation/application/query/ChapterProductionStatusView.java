package com.narrativex.backend.feature.generation.application.query;

import java.util.UUID;

/**
 * Authoritative production status summary for a chapter. Exposes readiness, shot counts by
 * lifecycle status, and overall pipeline progress. {@code productionSignature} changes whenever
 * anything shown by the full production view may have changed, so clients can skip refetching it.
 */
public record ChapterProductionStatusView(
    UUID chapterId,
    boolean storyReady,
    boolean audioReady,
    boolean voiceReady,
    int totalShots,
    int queuedShots,
    int generatingShots,
    int validatingShots,
    int passedShots,
    int failedShots,
    int blockedShots,
    int manualReviewShots,
    int selectedTakeCount,
    boolean generationReady,
    boolean timelineReady,
    boolean renderReady,
    int overallProgressPercent,
    UUID activeGenerationJobId,
    String productionSignature) {

  /** Compatibility constructor for callers that predate {@code productionSignature}. */
  public ChapterProductionStatusView(
      UUID chapterId,
      boolean storyReady,
      boolean audioReady,
      boolean voiceReady,
      int totalShots,
      int queuedShots,
      int generatingShots,
      int validatingShots,
      int passedShots,
      int failedShots,
      int blockedShots,
      int manualReviewShots,
      int selectedTakeCount,
      boolean generationReady,
      boolean timelineReady,
      boolean renderReady,
      int overallProgressPercent,
      UUID activeGenerationJobId) {
    this(
        chapterId,
        storyReady,
        audioReady,
        voiceReady,
        totalShots,
        queuedShots,
        generatingShots,
        validatingShots,
        passedShots,
        failedShots,
        blockedShots,
        manualReviewShots,
        selectedTakeCount,
        generationReady,
        timelineReady,
        renderReady,
        overallProgressPercent,
        activeGenerationJobId,
        null);
  }
}
