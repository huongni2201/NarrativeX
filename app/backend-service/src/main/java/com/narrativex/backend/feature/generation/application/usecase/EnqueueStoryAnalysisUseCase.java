package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import org.springframework.stereotype.Service;

@Service
public class EnqueueStoryAnalysisUseCase {
  private static final String UNAVAILABLE_MESSAGE =
      "Story analysis is not available until durable chapter-scoped enqueue, worker dispatch, "
          + "idempotency, entitlement/quota, safety, and cost-reservation controls are implemented";

  public GenerationJob execute(EnqueueStoryAnalysisCommand command) {
    throw new FeatureNotAvailableException(UNAVAILABLE_MESSAGE);
  }
}
