package com.narrativex.backend.feature.generation.api.response;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Authoritative production read model for a chapter. Provides complete visual beats, planned shot
 * sequences, shots, candidate takes, authoritative SelectedTake bindings, QA metrics, and preflight
 * readiness.
 */
public record ChapterProductionResponse(
    UUID chapterId,
    String chapterTitle,
    int chapterOrderIndex,
    int totalShots,
    int readyShots,
    int selectedShots,
    int overallProgressPercent,
    String status,
    List<ProductionSceneItem> scenes) {

  public record ProductionSceneItem(
      UUID id, int orderIndex, String title, List<ProductionVisualBeatItem> visualBeats) {}

  public record ProductionVisualBeatItem(
      UUID id,
      UUID sceneId,
      UUID storyBeatId,
      int orderIndex,
      String title,
      String visualIntent,
      String dramaticIntent,
      String retentionRole,
      String reviewStatus,
      UUID previewMediaAssetId,
      String prompt,
      List<ProductionAudioCueItem> audioCues,
      ProductionShotSequenceItem shotSequence) {}

  public record ProductionAudioCueItem(
      UUID id,
      UUID storyBeatId,
      int orderIndex,
      String cueType,
      UUID speakerProjectCharacterId,
      String speakerName,
      String adaptedText,
      UUID characterId,
      UUID voiceProfileId,
      UUID voiceReferenceAssetId,
      boolean voiceReady) {}

  public record ProductionShotSequenceItem(
      UUID id, UUID visualBeatId, int orderIndex, List<ProductionShotItem> shots) {}

  public record ProductionShotItem(
      UUID id,
      UUID sequenceId,
      int orderIndex,
      String narrativePurpose,
      String retentionRole,
      List<String> subjects,
      String locationRef,
      String startState,
      String action,
      String endState,
      String composition,
      String camera,
      String subjectMotion,
      String cameraMotion,
      String environmentMotion,
      long targetDurationMs,
      GenerationStrategy generationStrategy,
      String qualityProfile,
      String status,
      List<ProductionTakeItem> takes,
      ProductionSelectedTakeItem selectedTake,
      ProductionPreflightItem preflight) {}

  public record ProductionTakeItem(
      UUID id,
      UUID shotId,
      int attemptNumber,
      String provider,
      String model,
      GenerationStrategy generationMode,
      UUID outputAssetId,
      Long sourceDurationMs,
      String metricsJson,
      String validationStatus,
      VideoQAFailureCategory validationFailureCategory,
      String validationFailureReason,
      String validationRetryRecommendation,
      String status,
      Instant createdAt,
      WhisperXSummaryItem whisperXSummary) {}

  public record ProductionSelectedTakeItem(
      UUID shotId, UUID takeId, long sourceInMs, long sourceOutMs) {}

  public record ProductionPreflightItem(
      boolean ready, List<String> blockers, List<String> warnings) {}

  public record WhisperXSummaryItem(
      String expectedText,
      String recognizedText,
      Double coverage,
      Double confidence,
      Boolean timingMatch,
      String status) {}
}
