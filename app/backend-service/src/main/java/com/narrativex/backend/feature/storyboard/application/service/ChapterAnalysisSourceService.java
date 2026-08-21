package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChapterAnalysisSourceService implements ChapterAnalysisSourceAccess {
  private final StoryboardRevisionAccess storyboardRevisionAccess;
  private final ChapterAnalysisSnapshotRepository chapterAnalysisSnapshotRepository;

  @Override
  @Transactional(propagation = Propagation.MANDATORY)
  public ChapterAnalysisSource requireOwnedForAnalysisLocked(
      Long projectId, Long chapterId, String userId) {
    // The first ownership-scoped read is deliberately unlocked. It prevents a caller from
    // acquiring an advisory lock for a Chapter outside its requested project scope.
    chapterAnalysisSnapshotRepository.requireOwnedByProject(projectId, chapterId, userId);

    // The advisory transaction lock is held by the outer admission transaction. Re-reading the
    // same ownership scope after the lock closes the gap between authorization and snapshotting.
    storyboardRevisionAccess.lockChapter(chapterId);
    return chapterAnalysisSnapshotRepository.requireOwnedByProject(projectId, chapterId, userId);
  }
}
