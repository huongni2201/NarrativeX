package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;

/** Fresh PostgreSQL read model for the Chapter snapshot consumed by analysis admission. */
public interface ChapterAnalysisSnapshotRepository {
  ChapterAnalysisSource requireById(Long chapterId);
}
