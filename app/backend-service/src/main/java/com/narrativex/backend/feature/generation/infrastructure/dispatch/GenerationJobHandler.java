package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import java.util.UUID;

/** Strategy interface for executing a specific type of generation job. */
public interface GenerationJobHandler {
  JobType supportedType();

  void execute(UUID jobId);
}
