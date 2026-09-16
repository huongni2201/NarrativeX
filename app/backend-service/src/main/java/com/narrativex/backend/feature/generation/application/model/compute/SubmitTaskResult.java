package com.narrativex.backend.feature.generation.application.model.compute;

import java.util.UUID;

public record SubmitTaskResult(UUID taskId, UUID attemptId, String state) {}
