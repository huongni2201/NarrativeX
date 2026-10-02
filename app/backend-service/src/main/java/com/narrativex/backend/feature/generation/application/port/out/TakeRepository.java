package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.domain.enums.VideoQAFailureCategory;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TakeRepository {
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
      Instant createdAt) {}
}
