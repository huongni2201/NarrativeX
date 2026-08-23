package com.narrativex.backend.feature.render.application.usecase;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.render.application.port.out.ArtifactContentRange;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactContentPort;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Opens authorized final-artifact content without buffering it in the application. */
@Service
@RequiredArgsConstructor
public class ReadFinalArtifactContentUseCase {
  private final FinalArtifactContentPort contentPort;

  public ArtifactContent execute(FinalArtifactView artifact, Long start, Long end) {
    if (!"READY".equalsIgnoreCase(artifact.status())) {
      throw new FeatureNotAvailableException("Final artifact content is not ready");
    }
    if (artifact.externalFileId() == null || artifact.externalFileId().isBlank()) {
      throw new FeatureNotAvailableException("Final artifact content is not configured");
    }
    return new ArtifactContent(
        artifact, contentPort.read(artifact.externalFileId().trim(), start, end));
  }

  public record ArtifactContent(FinalArtifactView metadata, ArtifactContentRange content) {}
}
