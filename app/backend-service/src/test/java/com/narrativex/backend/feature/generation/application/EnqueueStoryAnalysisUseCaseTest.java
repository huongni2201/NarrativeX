package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EnqueueStoryAnalysisUseCaseTest {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  @Mock private CurrentUserId currentUserId;
  @Mock private StoryVersionAccess storyVersionAccess;
  @Mock private ProjectAccess projectAccess;
  @Mock private ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  @Mock private StoryboardRevisionAccess storyboardRevisionAccess;
  @Mock private OperationPlanRepository operationPlanRepository;
  @Mock private GenerationJobRepository generationJobRepository;
  @Mock private StageAttemptRepository stageAttemptRepository;
  @Mock private GenerationOutboxRepository generationOutboxRepository;
  @Mock private ChapterAnalysisAdmissionService admissionService;
  @Mock private QuotaReservation quotaReservation;
  @InjectMocks private EnqueueStoryAnalysisUseCase useCase;

  @Test
  void chapterAnalysisHasADurableJobType() {
    assertEquals("CHAPTER_ANALYZE", JobType.CHAPTER_ANALYZE.name());
  }

  @Test
  void analysisCommandRequiresAValidProjectAndChapterScope() {
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(null, 11L));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(7L, null));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(0L, 11L));
    assertThrows(IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(7L, 0L));
  }

  @Test
  void derivesIdempotencyFromTheLockedAuthoritativeSnapshot() {
    var snapshot = new ChapterAnalysisSource(11L, 9L, 2L, SOURCE_HASH, "latest source");
    String expectedIdempotencyKey = "chapter-analysis:7:11:" + SOURCE_HASH;
    RuntimeException stop = new RuntimeException("stop after idempotency derivation");
    when(currentUserId.get()).thenReturn("user-1");
    when(chapterAnalysisSourceAccess.requireForAnalysisLocked(11L)).thenReturn(snapshot);
    doThrow(stop).when(generationJobRepository).acquireIdempotencyLock(expectedIdempotencyKey);

    var thrown =
        assertThrows(
            RuntimeException.class,
            () -> useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L)));

    assertSame(stop, thrown);
    InOrder order = inOrder(chapterAnalysisSourceAccess, generationJobRepository);
    order.verify(chapterAnalysisSourceAccess).requireForAnalysisLocked(11L);
    order.verify(generationJobRepository).acquireIdempotencyLock(expectedIdempotencyKey);
  }
}
