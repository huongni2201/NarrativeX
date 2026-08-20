package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.MediaPlan;

/** Insert-only persistence boundary for versioned media plans. */
public interface MediaPlanRepository {
  int nextRevision(Long chapterId);

  MediaPlan save(MediaPlan mediaPlan);
}
