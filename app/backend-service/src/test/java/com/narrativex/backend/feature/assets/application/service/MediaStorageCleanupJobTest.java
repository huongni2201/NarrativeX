package com.narrativex.backend.feature.assets.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaStorageCleanupTaskRepository.CleanupTask;
import com.narrativex.backend.feature.assets.application.port.out.ObjectStoragePort;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class MediaStorageCleanupJobTest {
  @Test
  void doesNotDeleteAKeyThatIsNowReferencedByReadyAsset() {
    var tasks = Mockito.mock(MediaStorageCleanupTaskRepository.class);
    var storage = Mockito.mock(ObjectStoragePort.class);
    var assets = Mockito.mock(MediaAssetRepository.class);
    var task =
        new CleanupTask(UUID.randomUUID(), "media/uploads/x", "late", "RUNNING", 1, Instant.now());
    when(tasks.claimDue(any(Integer.class), any(Instant.class), any(Instant.class)))
        .thenReturn(List.of(task));
    when(assets.isReferencedByReadyAsset(task.storageKey())).thenReturn(true);

    new MediaStorageCleanupJob(tasks, storage, assets).cleanup();

    verify(storage, never()).delete(task.storageKey());
    verify(tasks).markCompleted(eq(task.id()), any(Instant.class));
  }
}
