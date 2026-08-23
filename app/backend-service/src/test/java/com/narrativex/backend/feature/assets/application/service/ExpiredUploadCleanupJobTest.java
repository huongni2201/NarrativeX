package com.narrativex.backend.feature.assets.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaUploadSessionRepository;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class ExpiredUploadCleanupJobTest {
  @Test
  void reEnqueuesObjectThatArrivesAfterSessionWasRejected() {
    var sessions = Mockito.mock(MediaUploadSessionRepository.class);
    var finalization = Mockito.mock(MediaUploadFinalizationService.class);
    var storage = Mockito.mock(ObjectStoragePort.class);
    var tasks = Mockito.mock(MediaStorageCleanupTaskRepository.class);
    var upload =
        new MediaUploadSessionRepository.RejectedUpload(UUID.randomUUID(), "media/uploads/late");
    when(sessions.findExpiredPending(100)).thenReturn(List.of());
    when(sessions.findRejectedForCleanup(100)).thenReturn(List.of(upload));
    when(storage.head(upload.storageKey()))
        .thenReturn(new ObjectStoragePort.StoredObject(upload.storageKey(), 4, "text/plain", null));

    new ExpiredUploadCleanupJob(sessions, finalization, storage, tasks).cleanup();

    verify(tasks)
        .enqueue(eq(upload.storageKey()), eq("REJECTED_UPLOAD_RECONCILIATION"), any(Instant.class));
  }
}
