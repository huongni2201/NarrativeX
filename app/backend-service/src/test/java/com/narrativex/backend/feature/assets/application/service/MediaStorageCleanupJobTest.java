package com.narrativex.backend.feature.assets.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository.CleanupTask;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class MediaStorageCleanupJobTest {
  @Test
  void doesNotDeleteAKeyThatIsNowReferencedByReadyVoiceReference() {
    var tasks = Mockito.mock(MediaStorageCleanupTaskRepository.class);
    var storage = Mockito.mock(ObjectStoragePort.class);
    var voiceReferences = Mockito.mock(VoiceReferenceAssetRepository.class);
    var task =
        new CleanupTask(UUID.randomUUID(), "voices/account/x", "late", "RUNNING", 3, Instant.now());
    when(tasks.claimDue(any(Integer.class), any(Instant.class), any(Instant.class)))
        .thenReturn(List.of(task));
    when(voiceReferences.isReferencedByReadyAsset(task.storageKey())).thenReturn(true);

    new MediaStorageCleanupJob(tasks, storage, voiceReferences).cleanup();

    verify(storage, never()).delete(task.storageKey());
    verify(tasks).markCompleted(eq(task.id()), eq(task.attemptCount()), any(Instant.class));
  }

  @Test
  void failedCleanupUsesTheClaimedAttemptAsItsFence() {
    var tasks = Mockito.mock(MediaStorageCleanupTaskRepository.class);
    var storage = Mockito.mock(ObjectStoragePort.class);
    var voiceReferences = Mockito.mock(VoiceReferenceAssetRepository.class);
    var task =
        new CleanupTask(UUID.randomUUID(), "voices/account/y", "retry", "RUNNING", 4, Instant.now());
    when(tasks.claimDue(any(Integer.class), any(Instant.class), any(Instant.class)))
        .thenReturn(List.of(task));
    when(voiceReferences.isReferencedByReadyAsset(task.storageKey())).thenReturn(false);
    Mockito.doThrow(new IllegalStateException("storage unavailable"))
        .when(storage)
        .delete(task.storageKey());

    new MediaStorageCleanupJob(tasks, storage, voiceReferences).cleanup();

    verify(tasks)
        .markFailed(
            eq(task.id()),
            eq(task.attemptCount()),
            any(Instant.class),
            eq(IllegalStateException.class.getSimpleName()));
  }
}
