package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;

/** Persists durable generation delivery events in the same transaction as the job. */
public interface GenerationOutboxRepository {
  void enqueue(GenerationJob job);
}
