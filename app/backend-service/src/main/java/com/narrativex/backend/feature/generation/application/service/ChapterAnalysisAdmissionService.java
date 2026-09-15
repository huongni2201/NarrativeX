package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChapterAnalysisAdmissionService {
  private final NarrativeXLimitsProperties limits;
  private final GenerationJobRepository generationJobRepository;

  public void admit() {
    if (!limits.isStoryAnalysisEnabled()) {
      throw new FeatureNotAvailableException("Story analysis is not enabled.");
    }
    generationJobRepository.acquireAnalysisCapacityLock();
    if (generationJobRepository.countActiveJobs() >= limits.getMaxConcurrentExpensiveJobs()) {
      throw new GenerationAdmissionDeniedException(
          "CAPACITY_LIMIT", "The story-analysis concurrency limit is exhausted.");
    }
  }
}
