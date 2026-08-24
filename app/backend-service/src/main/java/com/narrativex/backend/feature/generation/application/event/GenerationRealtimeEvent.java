package com.narrativex.backend.feature.generation.application.event;

import com.narrativex.backend.feature.generation.api.response.GenerationEventResponse;
import com.narrativex.backend.feature.generation.api.response.JobResponse;
import java.util.UUID;

public record GenerationRealtimeEvent(
    String eventId, String userId, UUID projectId, JobResponse job) {
  public GenerationEventResponse response() {
    return new GenerationEventResponse(eventId, projectId, job);
  }
}
