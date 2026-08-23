package com.narrativex.backend.feature.render.application.usecase;

import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.render.application.port.in.ArtifactContentRange;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactContentPort;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Opens authorized final-artifact content without buffering it in the application. */
@Service
@RequiredArgsConstructor
public class ReadFinalArtifactContentUseCase {
  private final FinalArtifactContentPort contentPort;
  private MeterRegistry meterRegistry = Metrics.globalRegistry;

  @Autowired
  void setMeterRegistry(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;
  }

  public ArtifactContent execute(FinalArtifactView artifact, Long start, Long end) {
    if (!"READY".equalsIgnoreCase(artifact.status())) {
      throw new FeatureNotAvailableException("Final artifact content is not ready");
    }
    if (artifact.externalFileId() == null || artifact.externalFileId().isBlank()) {
      throw new FeatureNotAvailableException("Final artifact content is not configured");
    }
    if (start != null || end != null) {
      meterRegistry.counter("artifact_range_requests").increment();
    }
    return new ArtifactContent(
        artifact, contentPort.read(artifact.externalFileId().trim(), start, end));
  }

  public void recordStreamBytes(long bytes) {
    if (bytes > 0) {
      meterRegistry.counter("artifact_stream_bytes").increment(bytes);
    }
  }

  public record ArtifactContent(FinalArtifactView metadata, ArtifactContentRange content) {}
}
