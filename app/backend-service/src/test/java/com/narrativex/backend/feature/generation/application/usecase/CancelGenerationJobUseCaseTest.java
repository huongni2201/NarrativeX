package com.narrativex.backend.feature.generation.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.ComputeAttemptIdentity;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CancelGenerationJobUseCaseTest {
  @Test
  void lateSubmissionTimeoutPreservesCancellationIntent() {
    GenerationJobRepository repository = mock(GenerationJobRepository.class);
    GenerationJob pending =
        GenerationJob.create(
                UuidV7.random(), JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH)
            .markUnknown(
                GenerationJob.CANCEL_REQUESTED_CODE, "Cancel pending", java.time.Instant.now());
    when(repository.findByJobId(pending.getJobId())).thenReturn(Optional.of(pending));
    when(repository.save(any(GenerationJob.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    var nextReconcileAt = java.time.Instant.now().plusSeconds(30);

    var result =
        new com.narrativex.backend.feature.generation.application.service
                .GenerationJobTransactionService(repository)
            .markSubmissionUnknown(
                pending.getJobId(), "COMPUTE_SUBMIT_TIMEOUT", "Submit timed out", nextReconcileAt);

    assertEquals(GenerationJob.CANCEL_REQUESTED_CODE, result.getErrorCode());
    assertEquals(JobStatus.UNKNOWN, result.getStatus());
    assertEquals(nextReconcileAt, result.getNextReconcileAt());
  }

  @Test
  void cancelAckRunningKeepsCapacity() {
    GenerationJobRepository repository = mock(GenerationJobRepository.class);
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    GenerationJob queued =
        GenerationJob.create(
            UuidV7.random(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);
    GenerationJob running = queued.markRunning("GENERATING_MEDIA", 10);
    when(repository.findByJobId(queued.getJobId())).thenReturn(Optional.of(running));
    when(repository.save(any(GenerationJob.class)))
        .thenAnswer(
            invocation -> {
              GenerationJob saved = invocation.getArgument(0);
              when(repository.findByJobId(queued.getJobId())).thenReturn(Optional.of(saved));
              return saved;
            });
    when(execution.cancelTask(any(), any()))
        .thenAnswer(
            invocation -> {
              GenerationJob persisted = repository.findByJobId(queued.getJobId()).orElseThrow();
              assertEquals("COMPUTE_CANCEL_REQUESTED", persisted.getErrorCode());
              return Optional.of(
                  new com.narrativex.backend.feature.generation.application.model.compute
                      .ComputeObservationDto(
                      "1.0",
                      queued.getJobId(),
                      persisted.getComputeAttemptId(),
                      "RUNNING",
                      3,
                      java.time.Instant.now(),
                      "existing",
                      0.5,
                      java.util.List.of(),
                      null,
                      null));
            });

    GenerationJob canceled =
        new CancelGenerationJobUseCase(
                repository,
                execution,
                new com.narrativex.backend.feature.generation.application.service
                    .GenerationJobTransactionService(repository))
            .execute(queued.getJobId());

    assertEquals(JobStatus.UNKNOWN, canceled.getStatus());
    org.junit.jupiter.api.Assertions.assertNotNull(canceled.getNextReconcileAt());
    verify(execution)
        .cancelTask(
            queued.getJobId(), ComputeAttemptIdentity.forJob(queued.getJobId(), queued.getType()));
    verify(repository).save(any(GenerationJob.class));
  }

  @Test
  void cancelsQueuedJobWithoutCallingCompute() {
    GenerationJobRepository repository = mock(GenerationJobRepository.class);
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    GenerationJob queued =
        GenerationJob.create(
            UuidV7.random(), JobType.NARRATION_GENERATE, ResourceClass.PROVIDER_BATCH);
    when(repository.findByJobId(queued.getJobId())).thenReturn(Optional.of(queued));
    when(repository.save(any(GenerationJob.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    GenerationJob canceled =
        new CancelGenerationJobUseCase(
                repository,
                execution,
                new com.narrativex.backend.feature.generation.application.service
                    .GenerationJobTransactionService(repository))
            .execute(queued.getJobId());

    assertEquals(JobStatus.CANCELED, canceled.getStatus());
    verifyNoInteractions(execution);
  }
}
