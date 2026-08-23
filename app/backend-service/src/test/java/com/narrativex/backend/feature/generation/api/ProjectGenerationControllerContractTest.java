package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.api.controller.ProjectGenerationController;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.usecase.ConfirmChapterTranslationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateBatchNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateChapterNarrationUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProjectGenerationControllerContractTest {
  @Test
  void chapterAnalysisMapsProjectAndChapterToDurableEnqueue() {
    EnqueueStoryAnalysisUseCase useCase = mock(EnqueueStoryAnalysisUseCase.class);
    GenerateChapterNarrationUseCase narrationUseCase = mock(GenerateChapterNarrationUseCase.class);
    GenerateBatchNarrationUseCase batchNarrationUseCase = mock(GenerateBatchNarrationUseCase.class);
    ConfirmChapterTranslationUseCase translationUseCase =
        mock(ConfirmChapterTranslationUseCase.class);
    UUID projectId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    UUID chapterId = UuidV7.random();
    UUID storyboardRevisionId = UuidV7.random();
    var job =
        GenerationJob.createChapterAnalysis(
            projectId,
            storyVersionId,
            chapterId,
            storyboardRevisionId,
            2L,
            "a".repeat(64),
            "Chapter source",
            "vi-VN",
            "chapter-analysis:7:11:hash",
            "user-1");
    when(useCase.execute(new EnqueueStoryAnalysisCommand(projectId, chapterId))).thenReturn(job);
    ProjectGenerationController controller =
        new ProjectGenerationController(
            useCase, narrationUseCase, batchNarrationUseCase, translationUseCase);

    var response = controller.analyzeChapter(projectId, chapterId, null);

    assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
    assertEquals(job.getJobId(), response.getBody().data().jobId());
    verify(useCase).execute(new EnqueueStoryAnalysisCommand(projectId, chapterId));
  }
}
