package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TakeRepository {
  TakeRecord createPending(
      UUID shotId,
      int attemptNumber,
      String provider,
      String model,
      GenerationStrategy strategy,
      UUID generationJobId,
      UUID computeTaskId,
      UUID computeAttemptId,
      UUID operationPlanId,
      String inputSnapshotJson,
      String inputFingerprint);

  Optional<TakeRecord> findByGenerationJobId(UUID generationJobId);

  List<com.narrativex.backend.feature.generation.application.model.TakeInputSnapshot.Reference>
      findReferences(UUID projectId, UUID shotId);

  Optional<TakeRecord> findById(UUID id);

  List<TakeRecord> findByShotId(UUID shotId);

  List<TakeRecord> findByShotIds(List<UUID> shotIds);

  void updateStatus(UUID id, String status);

  record TakeRecord(
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
      UUID generationJobId,
      UUID computeTaskId,
      UUID computeAttemptId,
      UUID operationPlanId,
      String inputSnapshotJson,
      String inputFingerprint) {
    public TakeRecord(
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
        Instant createdAt) {
      this(
          id,
          shotId,
          attemptNumber,
          provider,
          model,
          generationMode,
          outputAssetId,
          sourceDurationMs,
          metricsJson,
          validationStatus,
          validationFailureCategory,
          validationFailureReason,
          validationRetryRecommendation,
          status,
          createdAt,
          null,
          null,
          null,
          null,
          null,
          null);
    }
  }
}
