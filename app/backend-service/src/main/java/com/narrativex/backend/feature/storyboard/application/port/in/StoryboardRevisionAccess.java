package com.narrativex.backend.feature.storyboard.application.port.in;

import java.util.UUID;

/** Internal orchestration port for chapter-scoped storyboard revisioning. */
public interface StoryboardRevisionAccess {
  void lockChapter(UUID chapterId);

  Snapshot current(UUID chapterId);

  UUID createDraft(UUID chapterId, String sourceHash, long sourceRowVersion);

  record Snapshot(UUID revisionId, String sourceHash, boolean hasApprovedOutput) {
    public static Snapshot empty() {
      return new Snapshot(null, null, false);
    }
  }
}
