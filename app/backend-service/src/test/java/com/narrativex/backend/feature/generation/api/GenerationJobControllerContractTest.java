package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.api.controller.GenerationJobController;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GenerationJobControllerContractTest {
  private final GetGenerationJobUseCase useCase = mock(GetGenerationJobUseCase.class);
  private final GenerationJobController controller = new GenerationJobController(useCase);

  @Test
  void getMapsPathToQueryAndWrapsDomainResult() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.rehydrate(
            UuidV7.random(),
            0L,
            jobId,
            projectId,
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
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    when(useCase.execute(any(GetGenerationJobQuery.class))).thenReturn(job);

    var responseEntity = controller.get(jobId);

    assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
    assertEquals(jobId, responseEntity.getBody().data().jobId());
    verify(useCase).execute(new GetGenerationJobQuery(jobId, null));
  }

  @Test
  void responseTargetsChapterWhenJobHasChapterScope() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    GenerationJob job =
        GenerationJob.rehydrate(
            UuidV7.random(),
            0L,
            jobId,
            projectId,
            JobType.NARRATION_GENERATE,
            JobStatus.QUEUED,
            ResourceClass.PROVIDER_INTERACTIVE,
            0,
            "QUEUED",
            null,
            "owner",
            "owner",
            storyVersionId,
            chapterId,
            null,
            0L,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    JobResponse response = JobResponse.from(job);

    assertEquals("CHAPTER", response.entityType());
    assertEquals(chapterId, response.entityId());
    assertEquals(new JobResponse.JobTarget("CHAPTER", chapterId), response.target());
  }
}
