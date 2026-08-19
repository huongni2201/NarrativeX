package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import java.util.List;
import java.util.Optional;

public interface ProviderOperationRepository {
  ProviderOperation save(ProviderOperation operation);

  Optional<ProviderOperation> findByFingerprint(String providerKey, String requestFingerprint);

  List<ProviderOperation> findByStatus(ProviderOperationStatus status, int limit);
}
