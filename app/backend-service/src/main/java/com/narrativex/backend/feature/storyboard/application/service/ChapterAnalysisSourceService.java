package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import java.util.UUID;
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
      UUID projectId, UUID chapterId, String userId) {
    chapterAnalysisSnapshotRepository.requireOwnedByProject(projectId, chapterId, userId);
    storyboardRevisionAccess.lockChapter(chapterId);
    return chapterAnalysisSnapshotRepository.requireOwnedByProject(projectId, chapterId, userId);
  }
}
