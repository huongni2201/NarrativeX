package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.NarrationRequest;
import java.util.Optional;
import java.util.UUID;

public interface NarrationRequestRepository {
  NarrationRequest save(NarrationRequest request);

  Optional<NarrationRequest> findByFingerprint(String requestFingerprint);

  Optional<NarrationRequest> findByGenerationJobId(UUID generationJobId);
}
