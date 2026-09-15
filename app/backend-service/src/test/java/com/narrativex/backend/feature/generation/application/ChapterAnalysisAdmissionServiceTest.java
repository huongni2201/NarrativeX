package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import org.junit.jupiter.api.Test;

class ChapterAnalysisAdmissionServiceTest {

  @Test
  void disabledStoryAnalysisIsRejected() {
    var limits = new NarrativeXLimitsProperties();
    limits.setStoryAnalysisEnabled(false);
    var repository = mock(GenerationJobRepository.class);
    var service = new ChapterAnalysisAdmissionService(limits, repository);

    assertThrows(FeatureNotAvailableException.class, service::admit);
  }

  @Test
  void activeJobsExceedingLimitRejectsWithCapacityLimit() {
    var limits = new NarrativeXLimitsProperties();
    limits.setStoryAnalysisEnabled(true);
    limits.setMaxConcurrentExpensiveJobs(2);
    var repository = mock(GenerationJobRepository.class);
    when(repository.countActiveJobs()).thenReturn(2);
    var service = new ChapterAnalysisAdmissionService(limits, repository);

    var exception = assertThrows(GenerationAdmissionDeniedException.class, service::admit);
    assertEquals("CAPACITY_LIMIT", exception.getCode());
    verify(repository).acquireAnalysisCapacityLock();
  }

  @Test
  void withinLimitsAdmitsSuccessfully() {
    var limits = new NarrativeXLimitsProperties();
    limits.setStoryAnalysisEnabled(true);
    limits.setMaxConcurrentExpensiveJobs(2);
    var repository = mock(GenerationJobRepository.class);
    when(repository.countActiveJobs()).thenReturn(1);
    var service = new ChapterAnalysisAdmissionService(limits, repository);

    assertDoesNotThrow(service::admit);
    verify(repository).acquireAnalysisCapacityLock();
  }
}
