package com.narrativex.backend.feature.common.pagination;

import java.time.Instant;

public record CursorKey(Instant updatedAt, long id) {
  public CursorKey {
    if (updatedAt == null) {
      throw new IllegalArgumentException("updatedAt must not be null");
    }
    if (id <= 0) {
      throw new IllegalArgumentException("id must be positive");
    }
  }
}
