package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/** Cross-feature contract for obtaining an authoritative Chapter snapshot. */
public interface ChapterAnalysisSourceAccess {
  ChapterAnalysisSource requireForAnalysisLocked(UUID projectId, UUID chapterId);
}
