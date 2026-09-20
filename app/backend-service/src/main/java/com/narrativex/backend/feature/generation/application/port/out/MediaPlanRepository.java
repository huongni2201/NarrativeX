package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;
import java.util.UUID;

/** Persistence boundary for immutable versioned media plans. */
public interface MediaPlanRepository {
  int nextRevision(UUID chapterId);

  MediaPlan save(MediaPlan mediaPlan);

  boolean existsForChapter(UUID mediaPlanId, int revision, UUID chapterId);
}
