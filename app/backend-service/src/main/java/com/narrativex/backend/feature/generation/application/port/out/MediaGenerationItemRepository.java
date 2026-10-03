package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MediaGenerationItemRepository {
  MediaGenerationItem save(MediaGenerationItem item);

  Optional<MediaGenerationItem> findById(UUID itemId);

  List<MediaGenerationItem> findByJobId(UUID jobId);

  void bindLeaf(UUID itemId, UUID leafJobId, UUID takeId);

  void updateExecution(UUID itemId, String status, UUID assetId, String errorCode);

  boolean review(UUID itemId, long rowVersion, String decision);
}
