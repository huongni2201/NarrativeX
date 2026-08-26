package com.narrativex.backend.feature.generation.api.response;

import java.util.UUID;

/** Public job id for the authoritative media-generation head of a chapter, when one exists. */
public record CurrentMediaJobResponse(UUID jobId) {}
