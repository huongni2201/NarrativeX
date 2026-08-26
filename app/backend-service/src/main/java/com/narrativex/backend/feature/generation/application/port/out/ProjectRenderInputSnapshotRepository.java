package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.query.ProductionTimelineView;
import com.narrativex.backend.feature.generation.domain.enums.RenderExecutionTarget;
import java.util.UUID;

public interface ProjectRenderInputSnapshotRepository {
  void create(
      UUID generationJobId,
      ProductionTimelineView timeline,
      String resolution,
      String format,
      RenderExecutionTarget executionTarget,
      UUID assignedLocalDeviceId,
      BackgroundMusicInput backgroundMusic);

  default void create(
      UUID generationJobId,
      ProductionTimelineView timeline,
      String resolution,
      String format,
      RenderExecutionTarget executionTarget,
      UUID assignedLocalDeviceId) {
    create(
        generationJobId,
        timeline,
        resolution,
        format,
        executionTarget,
        assignedLocalDeviceId,
        null);
  }

  record BackgroundMusicInput(
      UUID assetId,
      String storageMode,
      String storageKey,
      long sizeBytes,
      String checksum,
      long durationMs) {}
}
