package com.narrativex.backend.feature.generation.application.model.compute;

import java.util.UUID;

/** Durable target pin for one immutable compute attempt. */
public record ComputeTargetAssignment(
    UUID taskId, UUID attemptId, String executor, String targetId) {}
