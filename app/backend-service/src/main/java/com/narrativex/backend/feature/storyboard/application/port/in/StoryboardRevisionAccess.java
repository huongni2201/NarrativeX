package com.narrativex.backend.feature.storyboard.application.port.in;

/** Internal orchestration port for chapter-scoped storyboard revisioning. */
public interface StoryboardRevisionAccess {
  void lockChapter(Long chapterId);

  Snapshot current(Long chapterId);

  Long createDraft(Long chapterId, String sourceHash, long sourceRowVersion);

  record Snapshot(Long revisionId, String sourceHash, boolean hasApprovedOutput) {
    public static Snapshot empty() {
      return new Snapshot(null, null, false);
    }
  }
}
