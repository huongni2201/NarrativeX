package com.narrativex.backend.feature.generation.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.api.internal.ComputeEventRequest;
import com.narrativex.backend.feature.generation.application.event.GenerationJobChangedEvent;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeErrorDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeEventReceiptRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

class ComputeEventApplicationServiceTest {

  private GenerationJobRepository generationJobRepository;
  private ComputeEventReceiptRepository receiptRepository;
  private ComputeResultFinalizerRegistry finalizerRegistry;
  private ApplicationEventPublisher eventPublisher;
  private ComputeResultFinalizer imageFinalizer;
  private ComputeEventApplicationService service;

  @BeforeEach
  void setUp() {
    generationJobRepository = mock(GenerationJobRepository.class);
    receiptRepository = mock(ComputeEventReceiptRepository.class);
    eventPublisher = mock(ApplicationEventPublisher.class);
    imageFinalizer = mock(ComputeResultFinalizer.class);
    when(imageFinalizer.supportedType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(imageFinalizer.supports(org.mockito.ArgumentMatchers.eq(JobType.CHAPTER_GENERATE), any()))
        .thenReturn(true);

    finalizerRegistry = new ComputeResultFinalizerRegistry(List.of(imageFinalizer));
    service =
        new ComputeEventApplicationService(
            generationJobRepository, receiptRepository, finalizerRegistry, eventPublisher);
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

    when(receiptRepository.existsByEventId("evt_dup_1")).thenReturn(true);

    ComputeEventApplicationService.ProcessingOutcome outcome =
        service.processEvent(request, "hash");

    assertEquals(ComputeEventApplicationService.ProcessingOutcome.DUPLICATE, outcome);
    verify(receiptRepository, never())
        .recordReceipt(any(), any(), any(), any(), any(), any(), any());
    verify(generationJobRepository, never()).save(any());
  }

  @Test
  void acknowledgesStaleSequenceWithoutMutatingJob() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(
                UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(attemptId, "handle-1", 5L, Instant.now(), Instant.now().plusSeconds(10));

    when(receiptRepository.existsByEventId("evt_stale")).thenReturn(false);
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
    verify(receiptRepository)
        .recordReceipt(
            eq("evt_stale"),
            eq(taskId),
            eq(attemptId),
            eq(3L),
            eq("RUNNING"),
            any(Instant.class),
            eq("hash"));
  }

  @Test
  void preventsTerminalJobFromRegressing() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(
                UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markRunning("RUNNING", 100)
            .markCompleted("COMPLETED");

    when(receiptRepository.existsByEventId("evt_regress")).thenReturn(false);
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
        GenerationJob.create(
                UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(attemptId, "handle-1", 1L, Instant.now(), Instant.now().plusSeconds(10));

    when(receiptRepository.existsByEventId("evt_success")).thenReturn(false);
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
    verify(imageFinalizer)
        .finalizeResult(any(GenerationJob.class), any(ComputeObservationDto.class));
    verify(eventPublisher).publishEvent(any(GenerationJobChangedEvent.class));
  }

  @Test
  void transitionsJobToFailedOnComputeFailure() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job =
        GenerationJob.create(
                UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(attemptId, "handle-1", 1L, Instant.now(), Instant.now().plusSeconds(10));

    when(receiptRepository.existsByEventId("evt_fail")).thenReturn(false);
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
    verify(eventPublisher).publishEvent(any(GenerationJobChangedEvent.class));
  }

  @Test
  void successFinalizerReceivesPersistedCallbackVersion() {
    var job =
        GenerationJob.create(
                UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(
                UUID.randomUUID(), "handle", 1L, Instant.now(), Instant.now().plusSeconds(10));
    when(generationJobRepository.findByComputeAttempt(job.getJobId(), job.getComputeAttemptId()))
        .thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class)))
        .thenAnswer(i -> ((GenerationJob) i.getArgument(0)).toBuilder().rowVersion(1L).build());
    var request =
        new ComputeEventRequest(
            "persisted-version",
            "1.0",
            job.getJobId(),
            job.getComputeAttemptId(),
            2L,
            "SUCCEEDED",
            "handle",
            1.0,
            List.of(),
            null,
            null,
            Instant.now());
    service.processEvent(request, "hash");
    var captured = org.mockito.ArgumentCaptor.forClass(GenerationJob.class);
    verify(imageFinalizer).finalizeResult(captured.capture(), any());
    assertEquals(1L, captured.getValue().getRowVersion());
  }

  @Test
  void successWithoutFinalizerRemainsRecoverable() {
    var job =
        GenerationJob.create(
                UUID.randomUUID(), JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markSubmitting("SUBMITTING")
            .markSubmitted(
                UUID.randomUUID(), "handle", 1L, Instant.now(), Instant.now().plusSeconds(10));
    when(generationJobRepository.findByComputeAttempt(job.getJobId(), job.getComputeAttemptId()))
        .thenReturn(Optional.of(job));
    when(generationJobRepository.save(any(GenerationJob.class))).thenAnswer(i -> i.getArgument(0));
    var request =
        new ComputeEventRequest(
            "missing-finalizer",
            "1.0",
            job.getJobId(),
            job.getComputeAttemptId(),
            2L,
            "SUCCEEDED",
            "handle",
            1.0,
            List.of(),
            null,
            null,
            Instant.now());
    service.processEvent(request, "hash");
    var captured = org.mockito.ArgumentCaptor.forClass(GenerationJob.class);
    verify(generationJobRepository, org.mockito.Mockito.atLeastOnce()).save(captured.capture());
    assertEquals(JobStatus.UNKNOWN, captured.getValue().getStatus());
    org.junit.jupiter.api.Assertions.assertNotNull(captured.getValue().getNextReconcileAt());
  }

  @Test
  void successiveRunningCallbacksAdvanceProgressMonotonically() {
    UUID attemptId = UUID.randomUUID();
    var holder =
        new java.util.concurrent.atomic.AtomicReference<>(
            GenerationJob.create(
                    UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
                .markSubmitting("SUBMITTING")
                .markSubmitted(
                    attemptId, "handle-1", 1L, Instant.now(), Instant.now().plusSeconds(10)));
    GenerationJob initial = holder.get();
    when(generationJobRepository.findByComputeAttempt(initial.getJobId(), attemptId))
        .thenAnswer(i -> Optional.of(holder.get()));
    when(generationJobRepository.save(any(GenerationJob.class)))
        .thenAnswer(
            i -> {
              holder.set(i.getArgument(0));
              return i.getArgument(0);
            });

    double[] progress = {0.2, 0.5, 0.4};
    int[] expected = {20, 50, 50};
    for (int i = 0; i < progress.length; i++) {
      var request =
          new ComputeEventRequest(
              "evt_running_" + i,
              "1.0",
              initial.getJobId(),
              attemptId,
              2L + i,
              "RUNNING",
              "handle-1",
              progress[i],
              List.of(),
              null,
              null,
              Instant.now());
      assertEquals(
          ComputeEventApplicationService.ProcessingOutcome.PROCESSED,
          service.processEvent(request, "hash"));
      assertEquals(JobStatus.RUNNING, holder.get().getStatus());
      assertEquals(expected[i], holder.get().getProgress());
      assertEquals(2L + i, holder.get().getComputeSequence());
    }
    verify(eventPublisher, org.mockito.Mockito.times(3))
        .publishEvent(any(GenerationJobChangedEvent.class));
  }

  @Test
  void runningCallbackNeverReportsHundredPercentBeforeCompletion() {
    UUID attemptId = UUID.randomUUID();
    var holder =
        new java.util.concurrent.atomic.AtomicReference<>(
            GenerationJob.create(
                    UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
                .markSubmitting("SUBMITTING")
                .markSubmitted(
                    attemptId, "handle-1", 1L, Instant.now(), Instant.now().plusSeconds(10))
                .markRunningWithCompute("COMPUTING_MEDIA", 10, 1L, "RUNNING", "handle-1"));
    when(generationJobRepository.findByComputeAttempt(holder.get().getJobId(), attemptId))
        .thenAnswer(i -> Optional.of(holder.get()));
    when(generationJobRepository.save(any(GenerationJob.class)))
        .thenAnswer(
            i -> {
              holder.set(i.getArgument(0));
              return i.getArgument(0);
            });
    var request =
        new ComputeEventRequest(
            "evt_full",
            "1.0",
            holder.get().getJobId(),
            attemptId,
            2L,
            "RUNNING",
            "handle-1",
            1.0,
            List.of(),
            null,
            null,
            Instant.now());
    service.processEvent(request, "hash");
    assertEquals(99, holder.get().getProgress());
    assertEquals(JobStatus.RUNNING, holder.get().getStatus());
  }
}
