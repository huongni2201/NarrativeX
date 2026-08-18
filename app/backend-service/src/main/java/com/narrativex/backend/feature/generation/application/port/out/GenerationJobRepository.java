package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.Optional;

public interface GenerationJobRepository {
  GenerationJob save(GenerationJob job);

  Optional<GenerationJob> findByJobIdAndOwner(String jobId, String ownerId);
}
