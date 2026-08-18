package com.narrativex.backend.feature.storyboard.application.port.in;

/** Cross-feature contract for reading the persisted Chapter snapshot used by analysis. */
public interface ChapterAnalysisSourceAccess {
  ChapterAnalysisSource requireById(Long chapterId);
}
