package com.narrativex.backend.feature.generation.domain.aggregate;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerationJobComputeProgressTest {

  private static GenerationJob runningJob(int progress) {
    return GenerationJob.create(
            UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH)
        .markSubmitting("SUBMITTING")
        .markSubmitted(
            UUID.randomUUID(), "handle", 1L, Instant.now(), Instant.now().plusSeconds(10))
        .markRunningWithCompute("COMPUTING_MEDIA", progress, 1L, "RUNNING", "handle");
  }

  @Test
  void progressOnlyMovesForward() {
    var job = runningJob(50);

    var lower = job.recordComputeProgress(30, 2L, "RUNNING");
    var higher = job.recordComputeProgress(70, 2L, "RUNNING");

    assertThat(lower.getProgress()).isEqualTo(50);
    assertThat(higher.getProgress()).isEqualTo(70);
  }

  @Test
  void progressIsCappedBelowCompletion() {
    var job = runningJob(10);

    assertThat(job.recordComputeProgress(100, 2L, "RUNNING").getProgress()).isEqualTo(99);
    assertThat(job.recordComputeProgress(250, 2L, "RUNNING").getProgress()).isEqualTo(99);
    assertThat(job.recordComputeProgress(-5, 2L, "RUNNING").getProgress()).isEqualTo(10);
  }

  @Test
  void recordsSequenceAndStateWithoutChangingStatus() {
    var job = runningJob(10);

    var updated = job.recordComputeProgress(20, 9L, "RUNNING_STAGE_2");

    assertThat(updated.getStatus()).isEqualTo(JobStatus.RUNNING);
    assertThat(updated.getComputeSequence()).isEqualTo(9L);
    assertThat(updated.getLastComputeState()).isEqualTo("RUNNING_STAGE_2");
    assertThat(updated.getComputeExecutionHandle()).isEqualTo("handle");
  }

  @Test
  void keepsExistingSequenceAndStateWhenNotProvided() {
    var job = runningJob(10);

    var updated = job.recordComputeProgress(20, null, null);

    assertThat(updated.getComputeSequence()).isEqualTo(1L);
    assertThat(updated.getLastComputeState()).isEqualTo("RUNNING");
  }
}
