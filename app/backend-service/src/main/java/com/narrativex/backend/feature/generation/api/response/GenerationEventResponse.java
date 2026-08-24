package com.narrativex.backend.feature.generation.api.response;

import java.util.UUID;

public record GenerationEventResponse(String eventId, UUID projectId, JobResponse job) {}
