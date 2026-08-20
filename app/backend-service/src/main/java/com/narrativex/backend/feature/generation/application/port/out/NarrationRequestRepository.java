package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.NarrationRequest;
import java.util.Optional;

public interface NarrationRequestRepository {
  NarrationRequest save(NarrationRequest request);

  Optional<NarrationRequest> findByFingerprint(String requestFingerprint);
}
