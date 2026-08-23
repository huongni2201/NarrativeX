package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.Optional;

public interface GenerationJobRepository {
  GenerationJob save(GenerationJob job);

  Optional<GenerationJob> findByJobIdAndOwner(String jobId, String ownerId);

  Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey, String ownerId);

  /**
   * @deprecated use the owner-scoped overload; retained only for legacy migration tests.
   */
  @Deprecated
  default Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey) {
    return findByIdempotencyKey(idempotencyKey, null);
  }

  void acquireIdempotencyLock(String idempotencyKey, String ownerId);

  /**
   * @deprecated use the owner-scoped overload.
   */
  @Deprecated
  default void acquireIdempotencyLock(String idempotencyKey) {
    acquireIdempotencyLock(idempotencyKey, null);
  }
}
