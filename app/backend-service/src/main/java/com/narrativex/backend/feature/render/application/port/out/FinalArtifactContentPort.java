package com.narrativex.backend.feature.render.application.port.out;

import com.narrativex.backend.feature.render.application.port.in.ArtifactContentRange;

/** Provider-neutral outbound boundary for streaming immutable final-artifact content. */
public interface FinalArtifactContentPort {
  /**
   * Opens a one-shot stream for the requested inclusive byte range.
   *
   * @param externalFileId provider-owned immutable file identifier
   * @param start inclusive range start, or {@code null} for the complete artifact
   * @param end inclusive range end, or {@code null} for an open-ended range
   */
  ArtifactContentRange read(String externalFileId, Long start, Long end);
}
