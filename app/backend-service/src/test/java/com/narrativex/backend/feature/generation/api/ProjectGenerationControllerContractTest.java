package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.api.controller.ProjectGenerationController;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProjectGenerationControllerContractTest {
  @Test
  void chapterAnalysisMapsProjectAndChapterToDurableEnqueue() {
    EnqueueStoryAnalysisUseCase useCase = mock(EnqueueStoryAnalysisUseCase.class);
    var job =
        GenerationJob.createChapterAnalysis(
            7L,
            9L,
            11L,
            2L,
            "a".repeat(64),
            "Chapter source",
            "vi-VN",
            "chapter-analysis:7:11:hash",
            "user-1");
    when(useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L))).thenReturn(job);
    ProjectGenerationController controller = new ProjectGenerationController(useCase);

    var response = controller.analyzeChapter(7L, 11L);

    assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
    assertEquals(job.getJobId(), response.getBody().data().jobId());
    verify(useCase).execute(new EnqueueStoryAnalysisCommand(7L, 11L));
  }
}
