package com.narrativex.backend.feature.storyboard.application.port.in;

/**
 * Cross-feature contract for obtaining the authoritative Chapter snapshot used by analysis.
 * Implementations must acquire the Chapter serialization lock before reading the snapshot and must
 * participate in the caller's transaction so the lock remains held for the complete admission
 * boundary.
 */
public interface ChapterAnalysisSourceAccess {
  ChapterAnalysisSource requireForAnalysisLocked(Long chapterId);
}
