package com.narrativex.backend.feature.generation.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.api.internal.ComputeEventRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeErrorDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeEventReceiptMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ComputeEventReceiptRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ComputeEventApplicationServiceTest {

  private GenerationJobRepository generationJobRepository;
  private ComputeEventReceiptMapper receiptMapper;
  private ComputeResultFinalizerRegistry finalizerRegistry;
  private GenerationJobEventBroadcaster broadcaster;
  private ComputeResultFinalizer imageFinalizer;
  private ComputeEventApplicationService service;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    receiptMapper = mock(ComputeEventReceiptMapper.class);
    broadcaster = mock(GenerationJobEventBroadcaster.class);
    imageFinalizer = mock(ComputeResultFinalizer.class);
    when(imageFinalizer.supportedType()).thenReturn(JobType.CHAPTER_GENERATE);

    finalizerRegistry = new ComputeResultFinalizerRegistry(List.of(imageFinalizer));
    service =
        new ComputeEventApplicationService(
            generationJobRepository, receiptMapper, finalizerRegistry, broadcaster);
  }

  @Test
  void acknowledgesDuplicateEventWithoutProcessing() {
    ComputeEventRequest request =
        new ComputeEventRequest(
            "evt_dup_1",
            "1.0",
            UUID.randomUUID(),
            UUID.randomUUID(),
            2L,
            "RUNNING",
            null,
            0.5,
            List.of(),
            null,
            null,
            Instant.now());

    when(receiptMapper.existsByEventId("evt_dup_1")).thenReturn(true);

    ComputeEventApplicationService.ProcessingOutcome outcome =
        service.processEvent(request, "hash");

    assertEquals(ComputeEventApplicationService.ProcessingOutcome.DUPLICATE, outcome);
    verify(receiptMapper, never()).insert(any(ComputeEventReceiptRow.class));
    verify(generationJobRepository, never()).save(any());
  }

  @Test
  void acknowledgesStaleSequenceWithoutMutatingJob() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(attemptId, "handle-1", 5L, Instant.now(), Instant.now().plusSeconds(10));

    when(receiptMapper.existsByEventId("evt_stale")).thenReturn(false);
    when(generationJobRepository.findByComputeAttempt(taskId, attemptId))
        .thenReturn(Optional.of(job));

    ComputeEventRequest request =
        new ComputeEventRequest(
            "evt_stale",
            "1.0",
            taskId,
            attemptId,
            3L, // Sequence 3 is older than current 5
            "RUNNING",
            null,
            0.2,
            List.of(),
            null,
            null,
            Instant.now());

    ComputeEventApplicationService.ProcessingOutcome outcome =
        service.processEvent(request, "hash");

    assertEquals(ComputeEventApplicationService.ProcessingOutcome.STALE_SEQUENCE, outcome);
    verify(receiptMapper).insert(any(ComputeEventReceiptRow.class));
  }

  @Test
  void preventsTerminalJobFromRegressing() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markRunning("RUNNING", 100)
            .markCompleted("COMPLETED");

    when(receiptMapper.existsByEventId("evt_regress")).thenReturn(false);
    when(generationJobRepository.findByComputeAttempt(taskId, attemptId))
        .thenReturn(Optional.of(job));

    ComputeEventRequest request =
        new ComputeEventRequest(
            "evt_regress",
            "1.0",
            taskId,
            attemptId,
            10L,
            "RUNNING",
            null,
            0.5,
            List.of(),
            null,
            null,
            Instant.now());

    ComputeEventApplicationService.ProcessingOutcome outcome =
        service.processEvent(request, "hash");

    assertEquals(ComputeEventApplicationService.ProcessingOutcome.ALREADY_TERMINAL, outcome);
    assertEquals(JobStatus.COMPLETED, job.getStatus());
  }

  @Test
  void invokesFinalizerOnComputeSuccess() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(attemptId, "handle-1", 1L, Instant.now(), Instant.now().plusSeconds(10));

    when(receiptMapper.existsByEventId("evt_success")).thenReturn(false);
    when(generationJobRepository.findByComputeAttempt(taskId, attemptId))
        .thenReturn(Optional.of(job));
    when(generationJobRepository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));

    ComputeEventRequest request =
        new ComputeEventRequest(
            "evt_success",
            "1.0",
            taskId,
            attemptId,
            2L,
            "SUCCEEDED",
            "handle-1",
            1.0,
            List.of(),
            null,
            null,
            Instant.now());

    ComputeEventApplicationService.ProcessingOutcome outcome =
        service.processEvent(request, "hash");

    assertEquals(ComputeEventApplicationService.ProcessingOutcome.PROCESSED, outcome);
    verify(imageFinalizer).finalizeResult(any(GenerationJob.class), any(ComputeObservationDto.class));
    verify(broadcaster).broadcastJobEvent(any(GenerationJob.class));
  }

  @Test
  void transitionsJobToFailedOnComputeFailure() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(attemptId, "handle-1", 1L, Instant.now(), Instant.now().plusSeconds(10));

    when(receiptMapper.existsByEventId("evt_fail")).thenReturn(false);
    when(generationJobRepository.findByComputeAttempt(taskId, attemptId))
        .thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));

    ComputeEventRequest request =
        new ComputeEventRequest(
            "evt_fail",
            "1.0",
            taskId,
            attemptId,
            2L,
            "FAILED",
            "handle-1",
            null,
            List.of(),
            null,
            new ComputeErrorDto("OUT_OF_MEMORY", "PERMANENT", "GPU OOM", null, null),
            Instant.now());

    ComputeEventApplicationService.ProcessingOutcome outcome =
        service.processEvent(request, "hash");

    assertEquals(ComputeEventApplicationService.ProcessingOutcome.PROCESSED, outcome);
    verify(generationJobRepository).save(any(GenerationJob.class));
    verify(broadcaster).broadcastJobEvent(any(GenerationJob.class));
  }
}
