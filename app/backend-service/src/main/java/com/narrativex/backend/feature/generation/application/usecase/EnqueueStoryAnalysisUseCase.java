package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import org.springframework.stereotype.Service;

@Service
public class EnqueueStoryAnalysisUseCase {
  private static final String UNAVAILABLE_MESSAGE =
      "Story analysis is not available until durable enqueue, worker dispatch, idempotency, "
          + "entitlement/quota, safety, and cost-reservation controls are implemented";

  public ApiResponse<JobResponse> execute(EnqueueStoryAnalysisCommand command) {
    throw new FeatureNotAvailableException(UNAVAILABLE_MESSAGE);
  }
}
