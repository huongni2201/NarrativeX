package com.narrativex.backend.feature.generation.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.api.controller.ProjectGenerationController;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateBatchNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GenerateChapterNarrationUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetVoicePreviewResultUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.storyboard.application.usecase.GetChapterStoryboardUseCase;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ProjectGenerationControllerContractTest {
  @Test
  void chapterAnalysisMapsProjectAndChapterToDurableEnqueue() {
    EnqueueStoryAnalysisUseCase useCase = mock(EnqueueStoryAnalysisUseCase.class);
    GenerateChapterNarrationUseCase narrationUseCase = mock(GenerateChapterNarrationUseCase.class);
    GenerateBatchNarrationUseCase batchNarrationUseCase = mock(GenerateBatchNarrationUseCase.class);
    GetVoicePreviewResultUseCase voicePreviewResultUseCase =
        mock(GetVoicePreviewResultUseCase.class);
    GetChapterStoryboardUseCase storyboardUseCase = mock(GetChapterStoryboardUseCase.class);
    VisualPromptContextRepository visualPromptContextRepository =
        mock(VisualPromptContextRepository.class);
    VisualPromptComposer visualPromptComposer = mock(VisualPromptComposer.class);
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
            useCase,
            narrationUseCase,
            batchNarrationUseCase,
            voicePreviewResultUseCase,
            (requestedProjectId, requestedChapterId, visualBeatId) -> null);

    var response = controller.analyzeChapter(projectId, chapterId);

    assertEquals(HttpStatus.ACCEPTED, response.getStatusCode());
    assertEquals(job.getJobId(), response.getBody().data().jobId());
    verify(useCase).execute(new EnqueueStoryAnalysisCommand(projectId, chapterId));
  }
}
