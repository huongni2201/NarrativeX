package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.application.render.SubtitleStyle;
import java.util.UUID;

public interface ProjectRenderInputSnapshotRepository {
  void create(
      UUID generationJobId,
      ProductionTimelineView timeline,
      String resolution,
      String format,
      UUID assignedLocalDeviceId,
      int fps,
      boolean subtitlesEnabled,
      boolean watermarkRequired,
      SubtitleStyle subtitleStyle);

  default void create(
      UUID generationJobId,
      ProductionTimelineView timeline,
      String resolution,
      String format,
      UUID assignedLocalDeviceId,
      int fps,
      boolean subtitlesEnabled,
      boolean watermarkRequired) {
    create(
        generationJobId,
        timeline,
        resolution,
        format,
        assignedLocalDeviceId,
        fps,
        subtitlesEnabled,
        watermarkRequired,
        null);
  }
}
