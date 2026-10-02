package com.narrativex.backend.feature.generation.api.response;

import java.util.UUID;

/**
 * Authoritative production status summary for a chapter.
 * Exposes readiness, shot counts by lifecycle status, and overall pipeline progress.
 */
public record ChapterProductionStatusResponse(
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
    UUID activeGenerationJobId) {}
