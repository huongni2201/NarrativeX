package com.narrativex.backend.feature.render.application.port.in;

import java.io.InputStream;

/**
 * A provider-neutral, one-shot stream of final-artifact bytes.
 *
 * <p>The stream is owned by the caller and must be closed after it has been copied to the HTTP
 * response. Implementations must not materialize the complete artifact in memory.
 */
public record ArtifactContentRange(
    InputStream content,
    Long contentLength,
    Long rangeStart,
    Long rangeEnd,
    Long totalLength,
    boolean partial) {

  public ArtifactContentRange {
    if (content == null) throw new IllegalArgumentException("content must not be null");
    if (contentLength != null && contentLength < 0) {
      throw new IllegalArgumentException("contentLength must not be negative");
    }
    if (rangeStart != null && rangeStart < 0) {
      throw new IllegalArgumentException("rangeStart must not be negative");
    }
    if (rangeEnd != null && rangeEnd < 0) {
      throw new IllegalArgumentException("rangeEnd must not be negative");
    }
    if (rangeStart != null && rangeEnd != null && rangeEnd < rangeStart) {
      throw new IllegalArgumentException("rangeEnd must not be before rangeStart");
    }
    if (totalLength != null && totalLength < 0) {
      throw new IllegalArgumentException("totalLength must not be negative");
    }
  }

  public String contentRangeHeader() {
    if (!partial || rangeStart == null || rangeEnd == null || totalLength == null) return null;
    return "bytes " + rangeStart + "-" + rangeEnd + "/" + totalLength;
  }
}
