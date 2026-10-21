package com.narrativex.backend.feature.generation.api.request;

public record CreateVisualBeatImageAttemptRequest(
    String aspectRatio, Long expectedPromptRevision) {}
