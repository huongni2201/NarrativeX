package com.narrativex.backend.feature.assets.application.service;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Bounds storage leakage from expired or abandoned presigned upload intents. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = "narrativex.storage.upload-cleanup-enabled",
    havingValue = "true",
    matchIfMissing = true)
public class ExpiredUploadCleanupJob {
  private final MediaUploadSessionRepository sessions;
  private final MediaUploadFinalizationService finalization;
  private final MediaStorageCleanupTaskRepository cleanupTasks;

  @Scheduled(fixedDelayString = "${narrativex.storage.upload-cleanup-delay-ms:300000}")
  public void cleanup() {
    List<MediaUploadSessionRepository.ExpiredUpload> expired = sessions.findExpiredPending(100);
    for (var upload : expired) {
      try {
        finalization.rejectExpired(upload.accountId(), upload.id());
      } catch (RuntimeException exception) {
        // A later scan retries the short database transition. Object deletion is handled
        // separately by MediaStorageCleanupJob after the rejection has committed.
      }
    }
    reconcileRejectedUploads();
  }

  private void reconcileRejectedUploads() {
    List<MediaUploadSessionRepository.RejectedUpload> rejected =
        sessions.findRejectedForCleanup(100);
    for (var upload : rejected) {
      cleanupTasks.enqueue(upload.storageKey(), "REJECTED_UPLOAD_RECONCILIATION", Instant.now());
    }
  }
}
