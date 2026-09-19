package com.narrativex.backend.feature.generation.application.model.compute;

import java.util.UUID;

/**
 * Immediate receipt returned by the worker upon accepting a compute task submission.
 */
public record ComputeSubmissionReceipt(
    UUID taskId,
    UUID attemptId,
    String executionHandle,
    String state,
    long sequence
) {}
