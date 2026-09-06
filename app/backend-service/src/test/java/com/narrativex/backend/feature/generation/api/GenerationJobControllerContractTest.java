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
import com.narrativex.backend.feature.generation.domain.value.AnalysisProgress;
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
  void getMapsPathToQueryAndWrapsDomainResultWithAnalysisProgress() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    UUID reportId = UuidV7.random();
    GenerationJob job =
        GenerationJob.rehydrate(
            UuidV7.random(),
            0L,
            jobId,
            projectId,
            JobType.CHAPTER_ANALYZE,
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
    AnalysisProgress progress =
        new AnalysisProgress("SHARDS", 2, 4, 1, 1, reportId, "continuity-v1");
    when(useCase.executeWithProgress(any(GetGenerationJobQuery.class)))
        .thenReturn(new GetGenerationJobUseCase.JobDetails(job, progress));

    var responseEntity = controller.get(jobId);
    JobResponse response = responseEntity.getBody().data();

    assertEquals(HttpStatus.OK, responseEntity.getStatusCode());
    assertEquals(jobId, response.jobId());
    assertEquals("SHARDS", response.phase());
    assertEquals(2, response.completedShards());
    assertEquals(4, response.totalShards());
    assertEquals(1, response.reusedShards());
    assertEquals(1, response.repairCount());
    assertEquals(reportId, response.continuityReportId());
    assertEquals("continuity-v1", response.pipelineVersion());
    verify(useCase).executeWithProgress(new GetGenerationJobQuery(jobId, null));
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
