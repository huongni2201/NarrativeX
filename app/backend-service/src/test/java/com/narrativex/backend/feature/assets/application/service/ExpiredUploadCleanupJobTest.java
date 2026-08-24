package com.narrativex.backend.feature.assets.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ExpiredUploadCleanupJobTest {
  @Test
  void enqueuesEachUnreconciledRejectedUploadForDurableCleanup() {
    var sessions = Mockito.mock(MediaUploadSessionRepository.class);
    var finalization = Mockito.mock(MediaUploadFinalizationService.class);
    var tasks = Mockito.mock(MediaStorageCleanupTaskRepository.class);
    var first =
        new MediaUploadSessionRepository.RejectedUpload(UUID.randomUUID(), "media/uploads/late-1");
    var second =
        new MediaUploadSessionRepository.RejectedUpload(UUID.randomUUID(), "media/uploads/late-2");
    when(sessions.findExpiredPending(100)).thenReturn(List.of());
    when(sessions.findRejectedForCleanup(100)).thenReturn(List.of(first, second));

    new ExpiredUploadCleanupJob(sessions, finalization, tasks).cleanup();

    verify(tasks)
        .enqueue(eq(first.storageKey()), eq("REJECTED_UPLOAD_RECONCILIATION"), any(Instant.class));
    verify(tasks)
        .enqueue(eq(second.storageKey()), eq("REJECTED_UPLOAD_RECONCILIATION"), any(Instant.class));
  }
}
