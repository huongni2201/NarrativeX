package com.narrativex.backend.feature.generation.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import java.math.BigDecimal;
import java.util.Optional;
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
    when(chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(7L, 11L, "user-1"))
        .thenReturn(snapshot);
    doThrow(stop).when(generationJobRepository).acquireIdempotencyLock(expectedIdempotencyKey, "user-1");

    var thrown =
        assertThrows(
            RuntimeException.class,
            () -> useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L)));

    assertSame(stop, thrown);
    InOrder order = inOrder(chapterAnalysisSourceAccess, generationJobRepository);
    order.verify(chapterAnalysisSourceAccess).requireOwnedForAnalysisLocked(7L, 11L, "user-1");
    order.verify(generationJobRepository).acquireIdempotencyLock(expectedIdempotencyKey, "user-1");
  }

  @Test
  void persistsExactlyOneDurableEnqueueBoundaryInOrder() {
    var snapshot = new ChapterAnalysisSource(11L, 9L, 2L, SOURCE_HASH, "latest source");
    var estimate =
        new com.narrativex.backend.feature.generation.application.service
            .ChapterAnalysisCostEstimate(20, BigDecimal.ONE, BigDecimal.TEN, BigDecimal.TEN);
    var reservation = new QuotaReservation.Reservation(77L, "user-1", "2026-08", BigDecimal.TEN);
    var persistedPlan =
        OperationPlan.rehydrate(
            501L,
            0L,
            7L,
            null,
            "CHAPTER_ANALYZE",
            BigDecimal.ONE,
            BigDecimal.TEN,
            BigDecimal.TEN,
            EstimateConfidence.LOW);
    var persistedJob =
        GenerationJob.rehydrate(
            601L,
            0L,
            "job-601",
            7L,
            JobType.CHAPTER_ANALYZE,
            JobStatus.QUEUED,
            ResourceClass.PROVIDER_INTERACTIVE,
            0,
            "QUEUED",
            null,
            "user-1",
            "user-1",
            9L,
            11L,
            101L,
            2L,
            SOURCE_HASH,
            "latest source",
            "vi-VN",
            "chapter-analysis:7:11:" + SOURCE_HASH);
    when(currentUserId.get()).thenReturn("user-1");
    when(chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(7L, 11L, "user-1"))
        .thenReturn(snapshot);
    when(projectAccess.findOwnedProject(7L, "user-1"))
        .thenReturn(
            org.mockito.Mockito.mock(
                com.narrativex.backend.feature.project.domain.aggregate.Project.class));
    when(projectAccess.findOwnedProject(7L, "user-1").getSourceLanguage()).thenReturn("vi-VN");
    when(generationJobRepository.findByIdempotencyKey("chapter-analysis:7:11:" + SOURCE_HASH, "user-1"))
        .thenReturn(Optional.empty());
    when(admissionService.admit("user-1", 7L, snapshot))
        .thenReturn(new ChapterAnalysisAdmissionService.Admission(estimate, reservation));
    when(storyboardRevisionAccess.createDraft(11L, SOURCE_HASH, 2L)).thenReturn(101L);
    when(operationPlanRepository.save(org.mockito.ArgumentMatchers.any(OperationPlan.class)))
        .thenReturn(persistedPlan);
    when(generationJobRepository.save(org.mockito.ArgumentMatchers.any(GenerationJob.class)))
        .thenReturn(persistedJob);

    GenerationJob result = useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L));

    assertSame(persistedJob, result);
    verify(operationPlanRepository, times(2))
        .save(org.mockito.ArgumentMatchers.any(OperationPlan.class));
    verify(generationJobRepository).save(org.mockito.ArgumentMatchers.any(GenerationJob.class));
    verify(quotaReservation).bindToGenerationJob(77L, 601L);
    verify(stageAttemptRepository)
        .create(
            org.mockito.ArgumentMatchers.argThat(
                a ->
                    a.getGenerationJobId().equals(601L)
                        && a.getStageName().equals("CHAPTER_ANALYSIS")
                        && a.getAttemptNumber() == 1));
    verify(generationOutboxRepository).enqueue(persistedJob);
  }

  @Test
  void duplicateEnqueueReturnsExistingJobWithoutCreatingDurableRows() {
    var snapshot = new ChapterAnalysisSource(11L, 9L, 2L, SOURCE_HASH, "latest source");
    var existing =
        GenerationJob.rehydrate(
            601L,
            0L,
            "job-601",
            7L,
            JobType.CHAPTER_ANALYZE,
            JobStatus.QUEUED,
            ResourceClass.PROVIDER_INTERACTIVE,
            0,
            "QUEUED",
            null,
            "user-1",
            "user-1",
            9L,
            11L,
            101L,
            2L,
            SOURCE_HASH,
            "latest source",
            "vi-VN",
            "chapter-analysis:7:11:" + SOURCE_HASH);
    when(currentUserId.get()).thenReturn("user-1");
    when(chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(7L, 11L, "user-1"))
        .thenReturn(snapshot);
    when(projectAccess.findOwnedProject(7L, "user-1")).thenReturn(null);
    when(generationJobRepository.findByIdempotencyKey("chapter-analysis:7:11:" + SOURCE_HASH, "user-1"))
        .thenReturn(Optional.of(existing));

    assertSame(existing, useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L)));

    verify(admissionService, never())
        .admit(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any());
    verify(operationPlanRepository, never()).save(org.mockito.ArgumentMatchers.any());
    verify(generationJobRepository, never()).save(org.mockito.ArgumentMatchers.any());
    verify(quotaReservation, never())
        .bindToGenerationJob(
            org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong());
    verify(stageAttemptRepository, never()).create(org.mockito.ArgumentMatchers.any());
    verify(generationOutboxRepository, never()).enqueue(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void failureBeforeOutboxDoesNotInvokeLaterDurableSteps() {
    var snapshot = new ChapterAnalysisSource(11L, 9L, 2L, SOURCE_HASH, "latest source");
    var estimate =
        new com.narrativex.backend.feature.generation.application.service
            .ChapterAnalysisCostEstimate(20, BigDecimal.ONE, BigDecimal.TEN, BigDecimal.TEN);
    var reservation = new QuotaReservation.Reservation(77L, "user-1", "2026-08", BigDecimal.TEN);
    RuntimeException failure = new RuntimeException("generation job insert failed");
    when(currentUserId.get()).thenReturn("user-1");
    when(chapterAnalysisSourceAccess.requireOwnedForAnalysisLocked(7L, 11L, "user-1"))
        .thenReturn(snapshot);
    var project =
        org.mockito.Mockito.mock(
            com.narrativex.backend.feature.project.domain.aggregate.Project.class);
    when(project.getSourceLanguage()).thenReturn("vi-VN");
    when(projectAccess.findOwnedProject(7L, "user-1")).thenReturn(project);
    when(generationJobRepository.findByIdempotencyKey("chapter-analysis:7:11:" + SOURCE_HASH, "user-1"))
        .thenReturn(Optional.empty());
    when(admissionService.admit("user-1", 7L, snapshot))
        .thenReturn(new ChapterAnalysisAdmissionService.Admission(estimate, reservation));
    when(storyboardRevisionAccess.createDraft(11L, SOURCE_HASH, 2L)).thenReturn(101L);
    when(operationPlanRepository.save(org.mockito.ArgumentMatchers.any(OperationPlan.class)))
        .thenReturn(
            OperationPlan.rehydrate(
                501L,
                0L,
                7L,
                null,
                "CHAPTER_ANALYZE",
                BigDecimal.ONE,
                BigDecimal.TEN,
                BigDecimal.TEN,
                EstimateConfidence.LOW));
    doThrow(failure)
        .when(generationJobRepository)
        .save(org.mockito.ArgumentMatchers.any(GenerationJob.class));

    assertSame(
        failure,
        assertThrows(
            RuntimeException.class,
            () -> useCase.execute(new EnqueueStoryAnalysisCommand(7L, 11L))));

    verify(quotaReservation, never())
        .bindToGenerationJob(
            org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyLong());
    verify(stageAttemptRepository, never()).create(org.mockito.ArgumentMatchers.any());
    verify(generationOutboxRepository, never()).enqueue(org.mockito.ArgumentMatchers.any());
  }
}
