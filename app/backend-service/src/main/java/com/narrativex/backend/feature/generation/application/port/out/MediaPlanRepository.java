package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import java.util.UUID;

/** Persistence boundary for immutable versioned media plans and ownership checks. */
public interface MediaPlanRepository {
  int nextRevision(Long chapterId);

  MediaPlan save(MediaPlan mediaPlan);

  boolean existsOwnedForChapter(UUID mediaPlanId, int revision, Long chapterId, String ownerId);
}
