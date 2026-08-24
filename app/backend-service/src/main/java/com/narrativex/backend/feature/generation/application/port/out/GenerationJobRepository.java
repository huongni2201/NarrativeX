package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.Optional;
import java.util.UUID;

public interface GenerationJobRepository {
  GenerationJob save(GenerationJob job);

  Optional<GenerationJob> findByJobIdAndOwner(UUID jobId, String ownerId);

  Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey, String ownerId);

  Optional<GenerationJob> findLatestByIdempotencyFamily(String baseIdempotencyKey, String ownerId);

  @Deprecated
  default Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey) {
    return findByIdempotencyKey(idempotencyKey, null);
  }

  void acquireIdempotencyLock(String idempotencyKey, String ownerId);

  @Deprecated
  default void acquireIdempotencyLock(String idempotencyKey) {
    acquireIdempotencyLock(idempotencyKey, null);
  }
}
