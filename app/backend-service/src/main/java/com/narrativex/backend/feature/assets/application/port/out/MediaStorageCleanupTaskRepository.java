package com.narrativex.backend.feature.assets.application.port.out;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MediaStorageCleanupTaskRepository {
  void enqueue(String storageKey, String reason, Instant nextAttemptAt);

  List<CleanupTask> claimDue(int limit, Instant now, Instant leaseUntil);

  void markCompleted(UUID id, int expectedAttemptCount, Instant completedAt);

  void markFailed(UUID id, int expectedAttemptCount, Instant nextAttemptAt, String lastError);

  record CleanupTask(
      UUID id,
      String storageKey,
      String reason,
      String status,
      int attemptCount,
      Instant nextAttemptAt) {}
}
