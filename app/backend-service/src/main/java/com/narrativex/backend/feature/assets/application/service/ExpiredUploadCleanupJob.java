package com.narrativex.backend.feature.assets.application.service;

import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Bounds storage leakage from expired or abandoned presigned upload intents. */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(
    name = "narrativex.storage.upload-cleanup-enabled", havingValue = "true", matchIfMissing = true)
public class ExpiredUploadCleanupJob {
  private final MediaUploadSessionRepository sessions;
  private final ObjectStoragePort objectStorage;

  @Scheduled(fixedDelayString = "${narrativex.storage.upload-cleanup-delay-ms:300000}")
  public void cleanup() {
    List<MediaUploadSessionRepository.ExpiredUpload> expired = sessions.findExpiredPending(100);
    for (var upload : expired) {
      try {
        objectStorage.delete(upload.storageKey());
        sessions.markRejected(upload.accountId(), upload.id());
      } catch (RuntimeException exception) {
        log.warn("Expired upload cleanup deferred id={} error={}", upload.id(), exception.getClass().getSimpleName());
      }
    }
  }
}
