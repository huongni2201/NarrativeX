package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import java.util.UUID;

/** Fresh PostgreSQL read model for the ownership-scoped saved Chapter source. */
public interface ChapterAnalysisSnapshotRepository {
  ChapterAnalysisSource requireOwnedByProject(UUID projectId, UUID chapterId, String userId);
}
