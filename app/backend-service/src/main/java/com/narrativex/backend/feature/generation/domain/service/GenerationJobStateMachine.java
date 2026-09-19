package com.narrativex.backend.feature.generation.domain.service;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import lombok.extern.slf4j.Slf4j;

/**
 * Enforces state machine invariants for GenerationJob transitions.
 */
@Slf4j
public final class GenerationJobStateMachine {

  private GenerationJobStateMachine() {}

  /**
   * Validates whether a transition from current to target status is permissible.
   * Terminal states (COMPLETED, FAILED, CANCELED) must never regress.
   */
  public static boolean canTransition(JobStatus current, JobStatus target) {
    if (current == null || target == null) {
      return false;
    }
    if (current == target) {
      return true;
    }
    if (current.isTerminal()) {
      log.warn("Illegal attempt to transition from terminal state {} to {}", current, target);
      return false;
    }

    return switch (current) {
      case QUEUED -> target == JobStatus.SUBMITTING
          || target == JobStatus.RUNNING
          || target == JobStatus.FAILED
          || target == JobStatus.CANCELED;
      case SUBMITTING -> target == JobStatus.SUBMITTED
          || target == JobStatus.RUNNING
          || target == JobStatus.UNKNOWN
          || target == JobStatus.FAILED
          || target == JobStatus.CANCELED;
      case SUBMITTED -> target == JobStatus.RUNNING
          || target == JobStatus.COMPLETED
          || target == JobStatus.FAILED
          || target == JobStatus.CANCELED
          || target == JobStatus.UNKNOWN
          || target == JobStatus.RECONCILING;
      case RUNNING -> target == JobStatus.RUNNING
          || target == JobStatus.COMPLETED
          || target == JobStatus.FAILED
          || target == JobStatus.CANCELED
          || target == JobStatus.UNKNOWN
          || target == JobStatus.RECONCILING;
      case UNKNOWN, RECONCILING, STALLED -> target == JobStatus.RUNNING
          || target == JobStatus.COMPLETED
          || target == JobStatus.FAILED
          || target == JobStatus.CANCELED
          || target == JobStatus.RECONCILING
          || target == JobStatus.UNKNOWN;
      default -> false;
    };
  }

  /**
   * Checks if an incoming event sequence is older than the currently recorded sequence.
   */
  public static boolean isStaleSequence(GenerationJob job, Long eventSequence) {
    if (eventSequence == null || job.getComputeSequence() == null) {
      return false;
    }
    return eventSequence < job.getComputeSequence();
  }

  /**
   * Checks if an incoming event sequence is equal to the currently recorded sequence.
   */
  public static boolean isDuplicateSequence(GenerationJob job, Long eventSequence) {
    if (eventSequence == null || job.getComputeSequence() == null) {
      return false;
    }
    return eventSequence.equals(job.getComputeSequence());
  }
}
