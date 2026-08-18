package com.narrativex.backend.feature.common.pagination;

import java.util.List;
import java.util.function.Function;

public record CursorPage<T>(List<T> content, String nextCursor, int limit, boolean hasNext) {
  public CursorPage {
    content = List.copyOf(content);
    if (limit < 1 || limit > 100) {
      throw new IllegalArgumentException("limit must be between 1 and 100");
    }
    if (!hasNext && nextCursor != null) {
      throw new IllegalArgumentException("nextCursor must be null when there is no next page");
    }
  }

  public <R> CursorPage<R> map(Function<? super T, R> mapper) {
    return new CursorPage<>(content.stream().map(mapper).toList(), nextCursor, limit, hasNext);
  }
}
