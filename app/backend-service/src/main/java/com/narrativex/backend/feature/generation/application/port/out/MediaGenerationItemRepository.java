package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MediaGenerationItemRepository {
  MediaGenerationItem save(MediaGenerationItem item);

  Optional<MediaGenerationItem> findById(UUID itemId);

  List<MediaGenerationItem> findByJobId(UUID jobId);

  /** Number of frozen items of a batch that have not been admitted yet. */
  long countQueued(UUID jobId);

  /** Public job id of the batch that owns the given leaf generation job (internal id). */
  Optional<UUID> findBatchJobIdByLeaf(UUID leafGenerationJobId);

  void bindLeaf(UUID itemId, UUID leafJobId, UUID takeId);

  void updateExecution(UUID itemId, String status, UUID assetId, String errorCode);

  boolean review(UUID itemId, long rowVersion, String decision);
}
