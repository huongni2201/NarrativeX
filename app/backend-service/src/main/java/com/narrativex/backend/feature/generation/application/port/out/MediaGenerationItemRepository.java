package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MediaGenerationItemRepository {
  MediaGenerationItem save(MediaGenerationItem item);

  Optional<MediaGenerationItem> findOwned(String userId, UUID itemId);

  List<MediaGenerationItem> findByJobOwned(String userId, Long jobId);

  boolean review(String userId, UUID itemId, long rowVersion, String decision);
}
