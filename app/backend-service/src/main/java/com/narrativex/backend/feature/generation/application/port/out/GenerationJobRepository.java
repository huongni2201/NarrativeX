package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.value.AnalysisProgress;
import java.util.Optional;
import java.util.UUID;

public interface GenerationJobRepository {
  GenerationJob save(GenerationJob job);

  Optional<GenerationJob> findByIdAndOwner(UUID id, String ownerId);

  Optional<GenerationJob> findByJobIdAndOwner(UUID jobId, String ownerId);

  Optional<AnalysisProgress> findAnalysisProgressByJobIdAndOwner(UUID jobId, String ownerId);

  Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey, String ownerId);

  Optional<GenerationJob> findLatestByIdempotencyFamily(String baseIdempotencyKey, String ownerId);

  void acquireIdempotencyLock(String idempotencyKey, String ownerId);

  void acquireImageCapacityLock(String ownerId);

  int countActiveImageJobs(String ownerId);
}
