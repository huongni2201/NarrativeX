package com.narrativex.backend.feature.storyboard.application.port.in;

/**
 * Cross-feature contract for obtaining an ownership-scoped authoritative Chapter snapshot.
 * Implementations authorize the requested project/chapter scope before acquiring the Chapter
 * serialization lock, then re-read the same scope after locking before returning the snapshot.
 */
public interface ChapterAnalysisSourceAccess {
  ChapterAnalysisSource requireOwnedForAnalysisLocked(
      Long projectId, Long chapterId, String userId);
}
