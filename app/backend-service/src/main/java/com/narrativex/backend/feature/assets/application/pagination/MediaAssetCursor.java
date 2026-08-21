package com.narrativex.backend.feature.assets.application.pagination;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public record MediaAssetCursor(Instant createdAt, UUID id) {
  public MediaAssetCursor {
    Objects.requireNonNull(createdAt, "createdAt");
    Objects.requireNonNull(id, "id");
  }
}
