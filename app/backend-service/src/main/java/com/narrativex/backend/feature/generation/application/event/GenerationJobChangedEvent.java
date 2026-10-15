package com.narrativex.backend.feature.generation.application.event;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;

/**
 * Published whenever a {@link GenerationJob} state changes in a way realtime clients care about.
 *
 * <p>Listeners that fan out to external observers (SSE, desktop clients) must consume this event
 * after the surrounding transaction commits, so clients never observe state that was rolled back or
 * not yet visible to a refetch.
 */
public record GenerationJobChangedEvent(GenerationJob job) {
  public GenerationJobChangedEvent {
    if (job == null) {
      throw new IllegalArgumentException("job must not be null");
    }
  }
}
