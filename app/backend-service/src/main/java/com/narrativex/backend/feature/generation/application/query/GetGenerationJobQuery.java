package com.narrativex.backend.feature.generation.application.query;

import java.util.UUID;

public record GetGenerationJobQuery(UUID jobId, String ownerId) {}
