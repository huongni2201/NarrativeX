package com.narrativex.backend.feature.generation.infrastructure.reconciliation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeErrorDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizer;
import com.narrativex.backend.feature.generation.application.service.ComputeResultFinalizerRegistry;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ComputeReconciliationServiceTest {

  private GenerationJobRepository jobRepository;
  private GenerationExecutionPort executionPort;
  private ComputeResultFinalizerRegistry finalizerRegistry;
  private ReconciliationBackoffPolicy backoffPolicy;
  private GenerationJobEventBroadcaster eventBroadcaster;
  private Clock clock;
  private ComputeReconciliationService service;

  private ConcurrentHashMap<UUID, GenerationJob> db;

  @BeforeEach
  void setUp() {
    jobRepository = mock(GenerationJobRepository.class);
    executionPort = mock(GenerationExecutionPort.class);
    finalizerRegistry = mock(ComputeResultFinalizerRegistry.class);
    backoffPolicy = new ReconciliationBackoffPolicy();
    eventBroadcaster = mock(GenerationJobEventBroadcaster.class);
    clock = Clock.fixed(Instant.parse("2026-09-19T10:00:00Z"), ZoneOffset.UTC);

    db = new ConcurrentHashMap<>();
    when(jobRepository.save(any(GenerationJob.class)))
        .thenAnswer(
            invocation -> {
              GenerationJob j = invocation.getArgument(0);
              db.put(j.getJobId(), j);
              return j;
            });
    when(jobRepository.findByJobId(any(UUID.class)))
        .thenAnswer(invocation -> Optional.ofNullable(db.get(invocation.getArgument(0))));

    service =
        new ComputeReconciliationService(
            jobRepository,
            executionPort,
            finalizerRegistry,
            backoffPolicy,
            eventBroadcaster,
            clock);
  }

  private GenerationJob sampleJob(UUID jobId, UUID attemptId, JobStatus status) {
    GenerationJob job =
        GenerationJob.create(
                UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
            .toBuilder()
            .jobId(jobId)
            .build()
            .markSubmitting("SUBMITTING")
            .markSubmitted(
                attemptId, "handle-123", 1L, Instant.now(), Instant.now().plusSeconds(10));

    if (status == JobStatus.RUNNING) {
      job = job.markRunningWithCompute("COMPUTING_MEDIA", 50, 1L, "RUNNING", "handle-123");
    } else if (status == JobStatus.COMPLETED) {
      job = job.markCompleted("COMPLETED");
    } else if (status == JobStatus.FAILED) {
      job = job.markFailed("ERROR", "FAILED");
    } else if (status == JobStatus.CANCELED) {
      job = job.markCanceled("CANCELED", "CANCELED");
    } else if (status == JobStatus.UNKNOWN) {
      job = job.markUnknown("UNKNOWN", "UNKNOWN");
    }
    return job;
  }

  @Test
  @DisplayName("ReconciliationBackoffPolicy calculates exponential delays accurately")
  void testBackoffPolicy() {
    assertThat(backoffPolicy.calculateDelay(0)).isEqualTo(Duration.ofSeconds(2));
    assertThat(backoffPolicy.calculateDelay(1)).isEqualTo(Duration.ofSeconds(5));
    assertThat(backoffPolicy.calculateDelay(2)).isEqualTo(Duration.ofSeconds(10));
    assertThat(backoffPolicy.calculateDelay(3)).isEqualTo(Duration.ofSeconds(30));
    assertThat(backoffPolicy.calculateDelay(4)).isEqualTo(Duration.ofSeconds(60));
    assertThat(backoffPolicy.calculateDelay(5)).isEqualTo(Duration.ofSeconds(300));
    assertThat(backoffPolicy.calculateDelay(100)).isEqualTo(Duration.ofSeconds(300));
  }

  @Test
  @DisplayName("Returns JOB_NOT_FOUND if job does not exist")
  void testJobNotFound() {
    UUID jobId = UUID.randomUUID();
    var result = service.reconcileOnce(jobId);
    assertThat(result).isEqualTo(ComputeReconciliationService.ReconciliationResult.JOB_NOT_FOUND);
  }

  @Test
  @DisplayName("Returns ALREADY_TERMINAL if job status is completed or failed")
  void testAlreadyTerminal() {
    UUID jobId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job = sampleJob(jobId, attemptId, JobStatus.COMPLETED);
    db.put(jobId, job);

    var result = service.reconcileOnce(jobId);
    assertThat(result)
        .isEqualTo(ComputeReconciliationService.ReconciliationResult.ALREADY_TERMINAL);
    verify(executionPort, never()).queryTask(any(), any());
  }

  @Test
  @DisplayName(
      "Reconciles worker query failure with backoff and marks UNKNOWN after repeated failures")
  void testWorkerQueryFailureBackoff() {
    UUID jobId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job = sampleJob(jobId, attemptId, JobStatus.SUBMITTED);
    // set reconcileAttemptCount to 2
    job = job.toBuilder().reconcileAttemptCount(2).build();
    db.put(jobId, job);

    when(executionPort.queryTask(jobId, attemptId))
        .thenThrow(new RuntimeException("Connection refused"));

    var result = service.reconcileOnce(jobId);
    assertThat(result)
        .isEqualTo(ComputeReconciliationService.ReconciliationResult.WORKER_UNAVAILABLE);

    GenerationJob updated = db.get(jobId);
    assertThat(updated.getReconcileAttemptCount()).isEqualTo(3);
    assertThat(updated.getLastReconciledAt()).isEqualTo(clock.instant());
    assertThat(updated.getNextReconcileAt())
        .isEqualTo(clock.instant().plus(Duration.ofSeconds(30)));
    // Since SUBMITTED and attempts >= 3, marked UNKNOWN
    assertThat(updated.getStatus()).isEqualTo(JobStatus.UNKNOWN);
  }

  @Test
  @DisplayName("Reconciles running observation, updates progress and sequences, and broadcasts")
  void testReconcileRunningObservation() {
    UUID jobId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job = sampleJob(jobId, attemptId, JobStatus.SUBMITTED);
    db.put(jobId, job);

    ComputeObservationDto observation =
        new ComputeObservationDto(
            "v1",
            jobId,
            attemptId,
            "RUNNING",
            2,
            clock.instant(),
            "handle-run",
            0.65,
            List.of(),
            null,
            null);

    when(executionPort.queryTask(jobId, attemptId)).thenReturn(observation);

    var result = service.reconcileOnce(jobId);
    assertThat(result)
        .isEqualTo(ComputeReconciliationService.ReconciliationResult.RECONCILED_RUNNING);

    GenerationJob updated = db.get(jobId);
    assertThat(updated.getStatus()).isEqualTo(JobStatus.RUNNING);
    assertThat(updated.getProgress()).isEqualTo(65);
    assertThat(updated.getComputeSequence()).isEqualTo(2L);
    assertThat(updated.getReconcileAttemptCount()).isEqualTo(1);
    assertThat(updated.getNextReconcileAt()).isEqualTo(clock.instant().plus(Duration.ofSeconds(5)));
    verify(eventBroadcaster).broadcastJobEvent(updated);
  }

  @Test
  @DisplayName("Reconciles succeeded observation by invoking ComputeResultFinalizer")
  void testReconcileSucceededObservation() {
    UUID jobId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job = sampleJob(jobId, attemptId, JobStatus.RUNNING);
    db.put(jobId, job);

    ComputeObservationDto observation =
        new ComputeObservationDto(
            "v1",
            jobId,
            attemptId,
            "SUCCEEDED",
            3,
            clock.instant(),
            "handle-run",
            1.0,
            List.of(),
            null,
            null);

    when(executionPort.queryTask(jobId, attemptId)).thenReturn(observation);

    ComputeResultFinalizer mockFinalizer = mock(ComputeResultFinalizer.class);
    when(finalizerRegistry.findFinalizer(JobType.CHAPTER_GENERATE))
        .thenReturn(Optional.of(mockFinalizer));

    var result = service.reconcileOnce(jobId);
    assertThat(result)
        .isEqualTo(ComputeReconciliationService.ReconciliationResult.RECONCILED_TERMINAL);

    verify(mockFinalizer).finalizeResult(eq(job), eq(observation));
    verify(eventBroadcaster).broadcastJobEvent(any(GenerationJob.class));
  }

  @Test
  @DisplayName("Reconciles failed observation, transitions to FAILED and clears nextReconcileAt")
  void testReconcileFailedObservation() {
    UUID jobId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job = sampleJob(jobId, attemptId, JobStatus.RUNNING);
    db.put(jobId, job);

    ComputeObservationDto observation =
        new ComputeObservationDto(
            "v1",
            jobId,
            attemptId,
            "FAILED",
            4,
            clock.instant(),
            "handle-fail",
            null,
            List.of(),
            null,
            new ComputeErrorDto(
                "OUT_OF_MEMORY", "RESOURCE", "GPU VRAM exhausted", null, java.util.Map.of()));

    when(executionPort.queryTask(jobId, attemptId)).thenReturn(observation);

    var result = service.reconcileOnce(jobId);
    assertThat(result)
        .isEqualTo(ComputeReconciliationService.ReconciliationResult.RECONCILED_TERMINAL);

    GenerationJob updated = db.get(jobId);
    assertThat(updated.getStatus()).isEqualTo(JobStatus.FAILED);
    assertThat(updated.getErrorCode()).isEqualTo("OUT_OF_MEMORY");
    assertThat(updated.getNextReconcileAt()).isNull();
    verify(eventBroadcaster).broadcastJobEvent(updated);
  }

  @Test
  @DisplayName("Reconciliation rejects stale sequence")
  void testStaleSequenceRejected() {
    UUID jobId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    GenerationJob job = sampleJob(jobId, attemptId, JobStatus.RUNNING);
    job = job.toBuilder().computeSequence(5L).build();
    db.put(jobId, job);

    ComputeObservationDto observation =
        new ComputeObservationDto(
            "v1",
            jobId,
            attemptId,
            "RUNNING",
            3, // older than 5
            clock.instant(),
            "handle-run",
            0.4,
            List.of(),
            null,
            null);

    when(executionPort.queryTask(jobId, attemptId)).thenReturn(observation);

    var result = service.reconcileOnce(jobId);
    assertThat(result).isEqualTo(ComputeReconciliationService.ReconciliationResult.STALE_SEQUENCE);

    GenerationJob updated = db.get(jobId);
    assertThat(updated.getComputeSequence()).isEqualTo(5L); // Not regressed
  }
}
