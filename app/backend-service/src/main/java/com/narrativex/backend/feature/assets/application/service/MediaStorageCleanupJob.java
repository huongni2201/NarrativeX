package com.narrativex.backend.feature.assets.application.service;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository.CleanupTask;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Deletes rejected or duplicate objects only after their durable DB decision commits. */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(
    name = "narrativex.storage.upload-cleanup-enabled", havingValue = "true", matchIfMissing = true)
public class MediaStorageCleanupJob {
  private static final int BATCH_SIZE = 100;
  private static final Duration LEASE = Duration.ofMinutes(5);

  private final MediaStorageCleanupTaskRepository tasks;
  private final ObjectStoragePort objectStorage;
  private final MediaAssetRepository assets;

  @Scheduled(fixedDelayString = "${narrativex.storage.upload-cleanup-delay-ms:300000}")
  public void cleanup() {
    Instant now = Instant.now();
    List<CleanupTask> claimed = tasks.claimDue(BATCH_SIZE, now, now.plus(LEASE));
    for (CleanupTask task : claimed) {
      try {
        if (assets.isReferencedByReadyAsset(task.storageKey())) {
          tasks.markCompleted(task.id(), Instant.now());
          continue;
        }
        objectStorage.delete(task.storageKey());
        tasks.markCompleted(task.id(), Instant.now());
      } catch (RuntimeException exception) {
        tasks.markFailed(task.id(), nextAttemptAt(task), exception.getClass().getSimpleName());
        log.warn(
            "Storage cleanup deferred id={} attempt={} error={}",
            task.id(),
            task.attemptCount(),
            exception.getClass().getSimpleName());
      }
    }
  }

  private static Instant nextAttemptAt(CleanupTask task) {
    long delayMinutes = Math.min(60, 1L << Math.min(task.attemptCount(), 6));
    return Instant.now().plus(Duration.ofMinutes(delayMinutes));
  }
}
