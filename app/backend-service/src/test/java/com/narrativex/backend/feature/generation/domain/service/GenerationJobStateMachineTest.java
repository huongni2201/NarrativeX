package com.narrativex.backend.feature.generation.domain.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerationJobStateMachineTest {

  @Test
  void progressCannotEraseDurableCancellationIntent() {
    var job =
        GenerationJob.create(UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.GPU_HEAVY)
            .markUnknown("COMPUTE_CANCEL_REQUESTED", "Cancel pending", Instant.now());
    var running = job.markRunningWithCompute("Progress", 50, 2L, "RUNNING", "handle");
    org.junit.jupiter.api.Assertions.assertEquals(
        "COMPUTE_CANCEL_REQUESTED", running.getErrorCode());
    org.junit.jupiter.api.Assertions.assertEquals(JobStatus.UNKNOWN, running.getStatus());
  }

  @Test
  void allowsValidForwardTransitions() {
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.QUEUED, JobStatus.SUBMITTING));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.SUBMITTING, JobStatus.SUBMITTED));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.SUBMITTED, JobStatus.RUNNING));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.RUNNING, JobStatus.COMPLETED));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.RUNNING, JobStatus.FAILED));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.RUNNING, JobStatus.UNKNOWN));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.UNKNOWN, JobStatus.RECONCILING));
    assertTrue(GenerationJobStateMachine.canTransition(JobStatus.RECONCILING, JobStatus.COMPLETED));
  }

  @Test
  void rejectsTerminalStateRegressions() {
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.COMPLETED, JobStatus.RUNNING));
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.COMPLETED, JobStatus.SUBMITTED));
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.COMPLETED, JobStatus.FAILED));
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.FAILED, JobStatus.RUNNING));
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.FAILED, JobStatus.SUBMITTING));
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.CANCELED, JobStatus.RUNNING));
    assertFalse(GenerationJobStateMachine.canTransition(JobStatus.CANCELED, JobStatus.COMPLETED));
  }

  @Test
  void detectsStaleAndDuplicateSequences() {
    UUID projectId = UuidV7.random();
    GenerationJob job =
        GenerationJob.create(projectId, JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH);

    job =
        job.markSubmitted(
            UuidV7.random(), "handle:1", 5L, Instant.now(), Instant.now().plusSeconds(10));

    assertTrue(GenerationJobStateMachine.isStaleSequence(job, 4L));
    assertFalse(GenerationJobStateMachine.isStaleSequence(job, 5L));
    assertFalse(GenerationJobStateMachine.isStaleSequence(job, 6L));

    assertTrue(GenerationJobStateMachine.isDuplicateSequence(job, 5L));
    assertFalse(GenerationJobStateMachine.isDuplicateSequence(job, 6L));
  }
}
