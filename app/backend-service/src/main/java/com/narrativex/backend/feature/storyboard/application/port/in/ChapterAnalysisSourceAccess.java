package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/**
 * Cross-feature contract for obtaining an ownership-scoped authoritative Chapter snapshot.
 * Implementations authorize the requested project/chapter scope before acquiring the Chapter
 * serialization lock, then re-read the same scope after locking before returning the snapshot.
 */
public interface ChapterAnalysisSourceAccess {
  ChapterAnalysisSource requireOwnedForAnalysisLocked(
      UUID projectId, UUID chapterId, String userId);

  default ChapterAnalysisSource requireOwnedForAnalysisLocked(
      UUID projectId, UUID chapterId, String userId, UUID contentVariantId) {
    return requireOwnedForAnalysisLocked(projectId, chapterId, userId);
  }
}
