package com.narrativex.backend.feature.common.pagination;

public record OrderIndexCursorKey(int orderIndex, long id) {
  public OrderIndexCursorKey {
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    if (id <= 0) {
      throw new IllegalArgumentException("id must be positive");
    }
  }
}
