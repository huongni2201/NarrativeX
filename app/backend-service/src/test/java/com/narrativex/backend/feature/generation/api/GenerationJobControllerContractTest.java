package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.api.controller.GenerationJobController;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import com.narrativex.backend.feature.generation.application.query.GetGenerationJobQuery;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventStreamService;
import com.narrativex.backend.feature.generation.application.usecase.GetGenerationJobUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class GenerationJobControllerContractTest {
  private final GetGenerationJobUseCase useCase = mock(GetGenerationJobUseCase.class);
  private final GenerationJobEventStreamService eventStreamService =
      mock(GenerationJobEventStreamService.class);
  private final GenerationJobController controller =
      new GenerationJobController(useCase, eventStreamService);

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
            null);
    when(useCase.execute(any(GetGenerationJobQuery.class))).thenReturn(job);

    var responseEntity = controller.get(jobId);

    assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
    assertEquals(jobId, responseEntity.getBody().data().jobId());
    verify(useCase).execute(new GetGenerationJobQuery(jobId, null));
  }

  @Test
  void eventsDelegatesToOwnerScopedStreamService() {
    UUID jobId = UuidV7.random();
    SseEmitter emitter = new SseEmitter();
    when(eventStreamService.subscribe(jobId)).thenReturn(emitter);

    assertSame(emitter, controller.events(jobId));

    verify(eventStreamService).subscribe(jobId);
  }

  @Test
  void responseTargetsChapterWhenJobHasChapterScope() {
    UUID projectId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID storyboardRevisionId = UuidV7.random();
    GenerationJob job =
        GenerationJob.createChapterAnalysis(
            projectId,
            storyVersionId,
            chapterId,
            storyboardRevisionId,
            0L,
            "source-hash",
            "source text",
            "vi-VN",
            "chapter-analysis:test",
            "owner");

    JobResponse response = JobResponse.from(job);

    assertEquals("CHAPTER", response.entityType());
    assertEquals(chapterId, response.entityId());
    assertEquals(new JobResponse.JobTarget("CHAPTER", chapterId), response.target());
  }
}
