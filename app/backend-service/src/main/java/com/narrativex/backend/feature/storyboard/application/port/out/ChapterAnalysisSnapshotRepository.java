package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import java.util.UUID;

/** Fresh PostgreSQL read model for the saved Chapter source. */
public interface ChapterAnalysisSnapshotRepository {
  ChapterAnalysisSource requireByProject(UUID projectId, UUID chapterId);
}
