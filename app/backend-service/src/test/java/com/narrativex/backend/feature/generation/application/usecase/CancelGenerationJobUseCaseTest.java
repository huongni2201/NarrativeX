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
  void cancelsRunningComputeAttemptAndPersistsCanceledState() {
    GenerationJobRepository repository = mock(GenerationJobRepository.class);
    GenerationExecutionPort execution = mock(GenerationExecutionPort.class);
    GenerationJob queued =
        GenerationJob.create(
            UuidV7.random(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);
    GenerationJob running = queued.markRunning("GENERATING_MEDIA", 10);
    when(repository.findByJobId(queued.getJobId())).thenReturn(Optional.of(running));
    when(repository.save(any(GenerationJob.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    GenerationJob canceled =
        new CancelGenerationJobUseCase(repository, execution).execute(queued.getJobId());

    assertEquals(JobStatus.CANCELED, canceled.getStatus());
    verify(execution)
        .cancelTask(
            queued.getJobId(), ComputeAttemptIdentity.forJob(queued.getJobId(), queued.getType()));
    verify(repository).save(canceled);
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
        new CancelGenerationJobUseCase(repository, execution).execute(queued.getJobId());

    assertEquals(JobStatus.CANCELED, canceled.getStatus());
    verifyNoInteractions(execution);
  }
}
