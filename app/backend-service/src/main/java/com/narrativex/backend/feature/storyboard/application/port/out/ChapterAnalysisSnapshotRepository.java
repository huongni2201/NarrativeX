package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;

/** Fresh PostgreSQL read model for the ownership-scoped Chapter snapshot consumed by admission. */
public interface ChapterAnalysisSnapshotRepository {
  ChapterAnalysisSource requireOwnedByProject(Long projectId, Long chapterId, String userId);
}
