package com.narrativex.backend.feature.generation.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.TakeRepository;
import com.narrativex.backend.feature.generation.application.usecase.GenerateShotTakeUseCase;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

class ChapterVideoBatchServiceLockingTest {
  private GenerationJobRepository jobs;
  private MediaGenerationItemRepository items;
  private ChapterAnalysisSourceAccess chapters;
  private ChapterVideoBatchService service;
  private GenerationJob batch;

  @BeforeEach
  void setUp() {
    jobs = mock(GenerationJobRepository.class);
    items = mock(MediaGenerationItemRepository.class);
    chapters = mock(ChapterAnalysisSourceAccess.class);
    PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    when(manager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
    service =
        new ChapterVideoBatchService(
            jobs,
            items,
            mock(TakeRepository.class),
            mock(GenerateShotTakeUseCase.class),
            chapters,
            new NarrativeXLimitsProperties(),
            mock(GenerationExecutionPort.class),
            manager);
    batch =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.BACKGROUND)
            .toBuilder()
            .id(UUID.randomUUID())
            .chapterId(UUID.randomUUID())
            .mediaPlanId(UUID.randomUUID())
            .mediaPlanRevision(1)
            .productionMode(ProductionMode.VIDEO_FIRST)
            .build();
    when(jobs.findByJobId(batch.getJobId())).thenReturn(Optional.of(batch));
    when(items.findByJobId(batch.getId())).thenReturn(List.of());
  }

  @Test
  void projectionOnlyResumeSkipsChapterAndCapacityLocks() {
    when(items.countQueued(batch.getId())).thenReturn(0L);

    service.resume(batch.getJobId());

    verify(jobs).acquireIdempotencyLock("chapter-video-batch:" + batch.getJobId());
    verify(chapters, never()).requireForAnalysisLocked(any(), any());
    verify(jobs, never()).acquireAnalysisCapacityLock();
  }

  @Test
  void resumeWithQueuedItemsStillTakesChapterThenCapacityLock() {
    when(items.countQueued(batch.getId())).thenReturn(3L);

    service.resume(batch.getJobId());

    var order = org.mockito.Mockito.inOrder(chapters, jobs);
    order.verify(chapters).requireForAnalysisLocked(batch.getProjectId(), batch.getChapterId());
    order.verify(jobs).acquireAnalysisCapacityLock();
  }
}
