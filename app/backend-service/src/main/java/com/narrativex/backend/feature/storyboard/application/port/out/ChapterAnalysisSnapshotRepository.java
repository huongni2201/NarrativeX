package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import java.util.UUID;

/** Fresh PostgreSQL read model for the ownership-scoped Chapter snapshot consumed by admission. */
public interface ChapterAnalysisSnapshotRepository {
  ChapterAnalysisSource requireOwnedByProject(UUID projectId, UUID chapterId, String userId);

  boolean existsReadyOriginalVariant(UUID projectId, UUID chapterId);

  default ChapterAnalysisSource requireOwnedByProject(
      UUID projectId, UUID chapterId, String userId, UUID contentVariantId) {
    return requireOwnedByProject(projectId, chapterId, userId);
  }
}
