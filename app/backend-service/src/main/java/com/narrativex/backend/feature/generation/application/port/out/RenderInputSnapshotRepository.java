package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.command.RenderBeatOverride;
import java.util.List;
import java.util.UUID;

public interface RenderInputSnapshotRepository {
  default SnapshotResult create(
      UUID generationJobId,
      UUID projectId,
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      UUID mediaPlanId,
      int mediaPlanRevision) {
    return create(
        generationJobId,
        projectId,
        chapterId,
        chapterRowVersion,
        sourceHash,
        mediaPlanId,
        mediaPlanRevision,
        List.of());
  }

  SnapshotResult create(
      UUID generationJobId,
      UUID projectId,
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      UUID mediaPlanId,
      int mediaPlanRevision,
      List<RenderBeatOverride> beatOverrides);

  record SnapshotResult(boolean narrationReady, int plannedBeatCount, int snapshottedBeatCount) {
    public boolean complete() {
      return narrationReady && plannedBeatCount > 0 && plannedBeatCount == snapshottedBeatCount;
    }
  }
}
