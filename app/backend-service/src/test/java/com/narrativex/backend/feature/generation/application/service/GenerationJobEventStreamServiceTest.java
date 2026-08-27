package com.narrativex.backend.feature.generation.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GenerationJobEventStreamServiceTest {
  private static final String OWNER_ID = "owner-1";

  @Mock private CurrentUserId currentUserId;
  @Mock private GenerationJobRepository generationJobRepository;
  @InjectMocks private GenerationJobEventStreamService service;

  @Test
  void rejectsSubscriptionWhenJobIsNotOwned() {
    UUID jobId = UuidV7.random();
    when(currentUserId.get()).thenReturn(OWNER_ID);
    when(generationJobRepository.findByJobIdAndOwner(jobId, OWNER_ID))
        .thenReturn(Optional.empty());

    assertThrows(ResourceNotFoundException.class, () -> service.subscribe(jobId));
    assertEquals(0, service.activeSubscriptionCount());
  }

  @Test
  void removesSubscriberWhenWatchedJobBecomesTerminal() {
    UUID jobId = UuidV7.random();
    UUID projectId = UuidV7.random();
    GenerationJob running = job(jobId, projectId, JobStatus.RUNNING, 25, 0L);
    GenerationJob completed = job(jobId, projectId, JobStatus.COMPLETED, 100, 1L);

    when(currentUserId.get()).thenReturn(OWNER_ID);
    when(generationJobRepository.findByJobIdAndOwner(jobId, OWNER_ID))
        .thenReturn(Optional.of(running), Optional.of(completed));

    service.subscribe(jobId);
    assertEquals(1, service.activeSubscriptionCount());

    service.publishChanges();

    assertEquals(0, service.activeSubscriptionCount());
  }

  private static GenerationJob job(
      UUID jobId, UUID projectId, JobStatus status, int progress, long rowVersion) {
    return GenerationJob.rehydrate(
        UuidV7.random(),
        rowVersion,
        jobId,
        projectId,
        JobType.STORY_ANALYZE,
        status,
        ResourceClass.FAST_CPU,
        progress,
        status == JobStatus.COMPLETED ? "DONE" : "ANALYZING",
        null,
        OWNER_ID,
        OWNER_ID,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }
}
