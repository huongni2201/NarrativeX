package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/** Cross-feature contract for obtaining an ownership-scoped authoritative Chapter snapshot. */
public interface ChapterAnalysisSourceAccess {
  ChapterAnalysisSource requireOwnedForAnalysisLocked(
      UUID projectId, UUID chapterId, String userId);
}
