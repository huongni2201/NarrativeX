package com.narrativex.backend.feature.generation.domain;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import org.junit.jupiter.api.Test;

class JobStatusTest {
  @Test
  void activeStatusesMatchWorkerProcessingSemantics() {
    assertTrue(JobStatus.QUEUED.isActive());
    assertTrue(JobStatus.RUNNING.isActive());
    assertTrue(JobStatus.STALLED.isActive());
    assertTrue(JobStatus.UNKNOWN.isActive());
    assertTrue(JobStatus.PAUSED_COST_LIMIT.isActive());

    assertFalse(JobStatus.COMPLETED.isActive());
    assertFalse(JobStatus.FAILED.isActive());
    assertFalse(JobStatus.CANCELED.isActive());
  }

  @Test
  void terminalStatusesUseBackendCanceledSpelling() {
    assertTrue(JobStatus.COMPLETED.isTerminal());
    assertTrue(JobStatus.FAILED.isTerminal());
    assertTrue(JobStatus.CANCELED.isTerminal());

    assertFalse(JobStatus.QUEUED.isTerminal());
    assertFalse(JobStatus.RUNNING.isTerminal());
    assertFalse(JobStatus.STALLED.isTerminal());
    assertFalse(JobStatus.UNKNOWN.isTerminal());
    assertFalse(JobStatus.PAUSED_COST_LIMIT.isTerminal());
  }
}
