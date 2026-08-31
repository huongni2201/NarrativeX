package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import java.util.UUID;

public interface ProjectRenderInputSnapshotRepository {
  void create(
      UUID generationJobId,
      ProductionTimelineView timeline,
      String resolution,
      String format,
      UUID assignedLocalDeviceId,
      int fps,
      boolean subtitlesEnabled);
}
