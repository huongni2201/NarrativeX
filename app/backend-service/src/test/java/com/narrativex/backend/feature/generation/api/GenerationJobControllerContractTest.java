package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.api.controller.GenerationJobController;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GenerationJobControllerContractTest {
  private final GetGenerationJobUseCase useCase = mock(GetGenerationJobUseCase.class);
  private final GenerationJobController controller = new GenerationJobController(useCase);

  @Test
  void getMapsPathToQueryAndWrapsDomainResult() {
    GenerationJob job =
        GenerationJob.rehydrate(
            1L,
            0L,
            "job-1",
            7L,
            JobType.STORY_ANALYZE,
            JobStatus.RUNNING,
            ResourceClass.FAST_CPU,
            40,
            "ANALYZING",
            null,
            "owner",
            "owner",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    when(useCase.execute(any(GetGenerationJobQuery.class))).thenReturn(job);

    var responseEntity = controller.get("job-1");

    assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
    assertEquals("job-1", responseEntity.getBody().data().jobId());
    verify(useCase).execute(new GetGenerationJobQuery("job-1", null));
  }

  @Test
  void responseTargetsChapterWhenJobHasChapterScope() {
    GenerationJob job =
        GenerationJob.rehydrate(
            2L,
            0L,
            "chapter-job",
            7L,
            JobType.NARRATION_GENERATE,
            JobStatus.QUEUED,
            ResourceClass.PROVIDER_INTERACTIVE,
            0,
            "QUEUED",
            null,
            "owner",
            "owner",
            9L,
            11L,
            null,
            0L,
            null,
            null,
            null,
            null);

    JobResponse response = JobResponse.from(job);

    assertEquals("CHAPTER", response.entityType());
    assertEquals(11L, response.entityId());
    assertEquals(new JobResponse.JobTarget("CHAPTER", 11L), response.target());
  }
}
