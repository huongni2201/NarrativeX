package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Stable compute attempt identity used by dispatch and user cancellation. */
public final class ComputeAttemptIdentity {
  private ComputeAttemptIdentity() {}

  public static UUID forJob(UUID jobId, JobType jobType) {
    return UUID.nameUUIDFromBytes(
        ("narrativex:compute-attempt:" + jobType.name() + ":" + jobId)
            .getBytes(StandardCharsets.UTF_8));
  }

  public static UUID forTake(UUID takeId, int attemptNumber) {
    return UUID.nameUUIDFromBytes(
        ("narrativex:compute-attempt:take:" + takeId + ":" + attemptNumber)
            .getBytes(StandardCharsets.UTF_8));
  }
}
