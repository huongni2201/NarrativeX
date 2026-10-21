package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerationJobTransactionServiceProgressTest {
  private final GenerationJobRepository repository = mock(GenerationJobRepository.class);
  private final GenerationJobTransactionService service =
      new GenerationJobTransactionService(repository);

  private GenerationJob running(int progress) {
    var job =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_ANALYZE, ResourceClass.BACKGROUND)
            .markRunning("ANTIGRAVITY_ANALYSIS", progress);
    when(repository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    when(repository.save(any(GenerationJob.class))).thenAnswer(call -> call.getArgument(0));
    return job;
  }

  @Test
  void aHigherValueIsSaved() {
    var job = running(10);

    var saved = service.recordProgress(job.getJobId(), 55);

    assertThat(saved).get().extracting(GenerationJob::getProgress).isEqualTo(55);
    verify(repository).save(any(GenerationJob.class));
  }

  @Test
  void aLowerOrEqualValueWritesNothing() {
    var job = running(60);

    assertThat(service.recordProgress(job.getJobId(), 40))
        .get()
        .extracting(GenerationJob::getProgress)
        .isEqualTo(60);
    assertThat(service.recordProgress(job.getJobId(), 60))
        .get()
        .extracting(GenerationJob::getProgress)
        .isEqualTo(60);

    verify(repository, never()).save(any(GenerationJob.class));
  }

  @Test
  void progressNeverReachesCompletion() {
    var job = running(10);

    var saved = service.recordProgress(job.getJobId(), 100);

    assertThat(saved).get().extracting(GenerationJob::getProgress).isEqualTo(99);
  }

  @Test
  void trustedStageLabelIsSavedEvenWhenPercentDidNotChange() {
    var job = running(50);

    var saved = service.recordProgress(job.getJobId(), 50, "ANTIGRAVITY_ANALYSIS_STORY");

    assertThat(saved).get().extracting(GenerationJob::getProgress).isEqualTo(50);
    assertThat(saved)
        .get()
        .extracting(GenerationJob::getCurrentStep)
        .isEqualTo("ANTIGRAVITY_ANALYSIS_STORY");
    verify(repository).save(any(GenerationJob.class));
  }

  @Test
  void aJobThatIsNotRunningIsLeftAlone() {
    var queued =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_ANALYZE, ResourceClass.BACKGROUND);
    when(repository.findByJobId(queued.getJobId())).thenReturn(Optional.of(queued));

    assertThat(service.recordProgress(queued.getJobId(), 50)).isEmpty();

    verify(repository, never()).save(any(GenerationJob.class));
  }

  @Test
  void aJobWithPendingCancellationIsLeftAlone() {
    var job = running(10).markUnknown(GenerationJob.CANCEL_REQUESTED_CODE, "cancel", null);
    when(repository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));

    assertThat(service.recordProgress(job.getJobId(), 50)).isEmpty();

    verify(repository, never()).save(any(GenerationJob.class));
  }
}
