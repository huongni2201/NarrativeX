package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.value.AnalysisProgress;
import java.util.Optional;
import java.util.UUID;

public interface GenerationJobRepository {
  GenerationJob save(GenerationJob job);

  Optional<GenerationJob> findById(UUID id);

  Optional<GenerationJob> findByJobId(UUID jobId);

  Optional<AnalysisProgress> findAnalysisProgressByJobId(UUID jobId);

  Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey);

  Optional<GenerationJob> findLatestByIdempotencyFamily(String baseIdempotencyKey);

  void acquireIdempotencyLock(String idempotencyKey);

  void acquireImageCapacityLock();

  void acquireAnalysisCapacityLock();

  int countActiveImageJobs();

  int countActiveJobs();
}
