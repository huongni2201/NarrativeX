package com.narrativex.backend.modules.generation.application.port.out;

import com.narrativex.backend.modules.generation.domain.aggregate.GenerationJob;
import java.util.Optional;

public interface GenerationJobRepository {
    GenerationJob save(GenerationJob job);
    Optional<GenerationJob> findByJobIdAndOwner(String jobId, String ownerId);
}
