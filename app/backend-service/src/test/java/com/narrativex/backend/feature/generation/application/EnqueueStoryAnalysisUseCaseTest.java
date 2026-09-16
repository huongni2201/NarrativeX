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

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.command.EnqueueStoryAnalysisCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.service.ChapterAnalysisAdmissionService;
import com.narrativex.backend.feature.generation.application.usecase.EnqueueStoryAnalysisUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EnqueueStoryAnalysisUseCaseTest {
  private static final UUID PROJECT_ID = UUID.fromString("018d4f4e-9f6b-7cb8-bdf4-f89a81e3f890");
  private static final UUID CHAPTER_ID = UUID.fromString("018d4f4e-9f6b-7cb8-bdf4-f89a81e3f891");
  private static final UUID STORY_VERSION_ID =
      UUID.fromString("018d4f4e-9f6b-7cb8-bdf4-f89a81e3f892");
  private static final UUID STORYBOARD_REVISION_ID =
      UUID.fromString("018d4f4e-9f6b-7cb8-bdf4-f89a81e3f893");
  private static final UUID JOB_ID = UUID.fromString("018d4f4e-9f6b-7cb8-bdf4-f89a81e3f894");
  private static final UUID PLAN_ID = UUID.fromString("018d4f4e-9f6b-7cb8-bdf4-f89a81e3f895");
  private static final long CHAPTER_ROW_VERSION = 4L;
  private static final String SOURCE_HASH = "sha256-abc";
  private static final String IDEMPOTENCY_KEY =
      "chapter-analysis:"
          + PROJECT_ID
          + ":"
          + CHAPTER_ID
          + ":"
          + CHAPTER_ROW_VERSION
          + ":"
          + SOURCE_HASH
          + ":IMAGE:API";

  @Mock private ProjectAccess projectAccess;
  @Mock private ChapterAnalysisSourceAccess chapterAnalysisSourceAccess;
  @Mock private StoryboardRevisionAccess storyboardRevisionAccess;
  @Mock private OperationPlanRepository operationPlanRepository;
  @Mock private GenerationJobRepository generationJobRepository;
  @Mock private StageAttemptRepository stageAttemptRepository;
  @Mock private GenerationOutboxRepository generationOutboxRepository;
  @Mock private ChapterAnalysisAdmissionService admissionService;

  private EnqueueStoryAnalysisUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new EnqueueStoryAnalysisUseCase(
            projectAccess,
            chapterAnalysisSourceAccess,
            storyboardRevisionAccess,
            operationPlanRepository,
            generationJobRepository,
            stageAttemptRepository,
            generationOutboxRepository,
            admissionService);
  }

  @Test
  void chapterAnalysisHasADurableJobType() {
    assertEquals("CHAPTER_ANALYZE", JobType.CHAPTER_ANALYZE.name());
  }

  @Test
  void analysisCommandRequiresAValidProjectAndChapterScope() {
    assertThrows(
        IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(null, CHAPTER_ID));
    assertThrows(
        IllegalArgumentException.class, () -> new EnqueueStoryAnalysisCommand(PROJECT_ID, null));
  }

  @Test
  void derivesIdempotencyFromTheLockedAuthoritativeSnapshot() {
    var snapshot = snapshot();
    RuntimeException stop = new RuntimeException("stop after idempotency derivation");
    when(chapterAnalysisSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(snapshot);
    doThrow(stop).when(generationJobRepository).acquireIdempotencyLock(IDEMPOTENCY_KEY);

    var thrown =
        assertThrows(
            RuntimeException.class,
            () -> useCase.execute(new EnqueueStoryAnalysisCommand(PROJECT_ID, CHAPTER_ID)));

    assertSame(stop, thrown);
    InOrder order = inOrder(chapterAnalysisSourceAccess, generationJobRepository);
    order.verify(chapterAnalysisSourceAccess).requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID);
    order.verify(generationJobRepository).acquireIdempotencyLock(IDEMPOTENCY_KEY);
  }

  @Test
  void persistsExactlyOneDurableEnqueueBoundaryInOrder() {
    var snapshot = snapshot();
    var persistedPlan = OperationPlan.rehydrate(PLAN_ID, 0L, PROJECT_ID, null, "CHAPTER_ANALYZE");
    var persistedJob = persistedJob(JobStatus.QUEUED);

    when(chapterAnalysisSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(snapshot);
    var project = org.mockito.Mockito.mock(Project.class);
    when(project.getSourceLanguage()).thenReturn("vi-VN");
    when(projectAccess.findProject(PROJECT_ID)).thenReturn(project);
    when(generationJobRepository.findByIdempotencyKey(IDEMPOTENCY_KEY))
        .thenReturn(Optional.empty());
    when(storyboardRevisionAccess.createDraft(CHAPTER_ID, SOURCE_HASH, CHAPTER_ROW_VERSION))
        .thenReturn(STORYBOARD_REVISION_ID);
    when(operationPlanRepository.save(org.mockito.ArgumentMatchers.any(OperationPlan.class)))
        .thenReturn(persistedPlan);
    when(generationJobRepository.save(org.mockito.ArgumentMatchers.any(GenerationJob.class)))
        .thenReturn(persistedJob);

    GenerationJob result = useCase.execute(new EnqueueStoryAnalysisCommand(PROJECT_ID, CHAPTER_ID));

    assertSame(persistedJob, result);
    verify(admissionService).admit();
    verify(operationPlanRepository, times(2))
        .save(org.mockito.ArgumentMatchers.any(OperationPlan.class));
    verify(generationJobRepository).save(org.mockito.ArgumentMatchers.any(GenerationJob.class));
    verify(stageAttemptRepository)
        .create(
            org.mockito.ArgumentMatchers.argThat(
                a ->
                    a.getGenerationJobId().equals(persistedJob.getId())
                        && a.getStageName().equals("CHAPTER_ANALYSIS")
                        && a.getAttemptNumber() == 1));
    verify(generationOutboxRepository).enqueue(persistedJob);
  }

  @Test
  void duplicateEnqueueReturnsExistingJobWithoutCreatingDurableRows() {
    var snapshot = snapshot();
    var existing = persistedJob(JobStatus.QUEUED);
    when(chapterAnalysisSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(snapshot);
    when(generationJobRepository.findByIdempotencyKey(IDEMPOTENCY_KEY))
        .thenReturn(Optional.of(existing));

    assertSame(existing, useCase.execute(new EnqueueStoryAnalysisCommand(PROJECT_ID, CHAPTER_ID)));

    verify(admissionService, never()).admit();
    verify(operationPlanRepository, never()).save(org.mockito.ArgumentMatchers.any());
    verify(generationJobRepository, never()).save(org.mockito.ArgumentMatchers.any());
    verify(stageAttemptRepository, never()).create(org.mockito.ArgumentMatchers.any());
    verify(generationOutboxRepository, never()).enqueue(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void differentRowVersionsProduceDifferentIdempotencyKeysForTheSameSource() {
    var newerSnapshot =
        new ChapterAnalysisSource(
            CHAPTER_ID, STORY_VERSION_ID, CHAPTER_ROW_VERSION + 1, SOURCE_HASH, "latest source");
    String newerKey =
        "chapter-analysis:"
            + PROJECT_ID
            + ":"
            + CHAPTER_ID
            + ":"
            + (CHAPTER_ROW_VERSION + 1)
            + ":"
            + SOURCE_HASH
            + ":IMAGE:API";
    RuntimeException stop = new RuntimeException("derived new snapshot key");
    when(chapterAnalysisSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(newerSnapshot);
    doThrow(stop).when(generationJobRepository).acquireIdempotencyLock(newerKey);

    assertSame(
        stop,
        assertThrows(
            RuntimeException.class,
            () -> useCase.execute(new EnqueueStoryAnalysisCommand(PROJECT_ID, CHAPTER_ID))));
    verify(generationJobRepository, never()).acquireIdempotencyLock(IDEMPOTENCY_KEY);
  }

  @Test
  void failureBeforeOutboxDoesNotInvokeLaterDurableSteps() {
    var snapshot = snapshot();
    RuntimeException failure = new RuntimeException("generation job insert failed");
    when(chapterAnalysisSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(snapshot);
    var project = org.mockito.Mockito.mock(Project.class);
    when(project.getSourceLanguage()).thenReturn("vi-VN");
    when(projectAccess.findProject(PROJECT_ID)).thenReturn(project);
    when(generationJobRepository.findByIdempotencyKey(IDEMPOTENCY_KEY))
        .thenReturn(Optional.empty());
    when(storyboardRevisionAccess.createDraft(CHAPTER_ID, SOURCE_HASH, CHAPTER_ROW_VERSION))
        .thenReturn(STORYBOARD_REVISION_ID);
    when(operationPlanRepository.save(org.mockito.ArgumentMatchers.any(OperationPlan.class)))
        .thenReturn(OperationPlan.rehydrate(PLAN_ID, 0L, PROJECT_ID, null, "CHAPTER_ANALYZE"));
    doThrow(failure)
        .when(generationJobRepository)
        .save(org.mockito.ArgumentMatchers.any(GenerationJob.class));

    assertSame(
        failure,
        assertThrows(
            RuntimeException.class,
            () -> useCase.execute(new EnqueueStoryAnalysisCommand(PROJECT_ID, CHAPTER_ID))));

    verify(stageAttemptRepository, never()).create(org.mockito.ArgumentMatchers.any());
    verify(generationOutboxRepository, never()).enqueue(org.mockito.ArgumentMatchers.any());
  }

  private static ChapterAnalysisSource snapshot() {
    return new ChapterAnalysisSource(
        CHAPTER_ID, STORY_VERSION_ID, CHAPTER_ROW_VERSION, SOURCE_HASH, "latest source");
  }

  private static GenerationJob persistedJob(JobStatus status) {
    return GenerationJob.rehydrate(
        UuidV7.random(),
        0L,
        JOB_ID,
        PROJECT_ID,
        JobType.CHAPTER_ANALYZE,
        status,
        ResourceClass.PROVIDER_INTERACTIVE,
        0,
        "QUEUED",
        null,
        STORY_VERSION_ID,
        CHAPTER_ID,
        STORYBOARD_REVISION_ID,
        CHAPTER_ROW_VERSION,
        SOURCE_HASH,
        "latest source",
        "vi-VN",
        IDEMPOTENCY_KEY);
  }
}
