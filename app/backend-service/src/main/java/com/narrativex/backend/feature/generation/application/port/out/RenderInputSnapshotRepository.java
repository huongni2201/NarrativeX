package com.narrativex.backend.feature.generation.application.port.out;

import java.util.UUID;

public interface RenderInputSnapshotRepository {
  SnapshotResult create(
      UUID generationJobId,
      UUID projectId,
      UUID chapterId,
      long chapterRowVersion,
      String sourceHash,
      UUID mediaPlanId,
      int mediaPlanRevision);

  record SnapshotResult(boolean narrationReady, int plannedBeatCount, int snapshottedBeatCount) {
    public boolean complete() {
      return narrationReady && plannedBeatCount > 0 && plannedBeatCount == snapshottedBeatCount;
    }
  }
}
