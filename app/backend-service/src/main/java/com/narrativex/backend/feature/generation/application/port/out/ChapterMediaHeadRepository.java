package com.narrativex.backend.feature.generation.application.port.out;

import java.util.UUID;

/** Maintains and validates the authoritative visual-generation job selected for a chapter. */
public interface ChapterMediaHeadRepository {
  void setCurrent(Long chapterId, Long generationJobId);

  boolean matchesCurrentPlan(Long chapterId, UUID mediaPlanId, int mediaPlanRevision);
}
