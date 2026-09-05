package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.Optional;
import java.util.UUID;

public interface GenerationJobRepository {
  GenerationJob save(GenerationJob job);

  Optional<GenerationJob> findByIdAndOwner(UUID id, String ownerId);

  Optional<GenerationJob> findByJobIdAndOwner(UUID jobId, String ownerId);

  Optional<GenerationJob> findByIdempotencyKey(String idempotencyKey, String ownerId);

  Optional<GenerationJob> findLatestByIdempotencyFamily(String baseIdempotencyKey, String ownerId);

  Optional<String> findRequestFingerprint(UUID id);

  void setRequestFingerprint(UUID id, String requestFingerprint);

  void acquireIdempotencyLock(String idempotencyKey, String ownerId);
}
