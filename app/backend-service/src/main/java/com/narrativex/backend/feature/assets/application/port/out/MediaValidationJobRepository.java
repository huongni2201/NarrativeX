package com.narrativex.backend.feature.assets.application.port.out;

import java.util.UUID;

public interface MediaValidationJobRepository {
  void enqueue(ValidationRequest request);

  record ValidationRequest(
      UUID mediaAssetId,
      String accountId,
      String storageKey,
      String declaredType,
      String declaredContentType,
      long expectedSizeBytes,
      String expectedSha256) {}
}
