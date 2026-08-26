package com.narrativex.backend.feature.generation.application.port.out;

import java.util.Optional;
import java.util.UUID;

/** Maintains and validates the authoritative visual-generation job selected for a chapter. */
public interface ChapterMediaHeadRepository {
  void setCurrent(UUID chapterId, UUID generationJobId);

  Optional<UUID> findCurrentJobId(UUID chapterId);

  boolean matchesCurrentPlan(UUID chapterId, UUID mediaPlanId, int mediaPlanRevision);
}
