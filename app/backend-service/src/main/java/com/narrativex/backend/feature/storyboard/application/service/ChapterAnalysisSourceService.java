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
  public ChapterAnalysisSource requireForAnalysisLocked(Long chapterId) {
    // The advisory transaction lock must be acquired before the authoritative PostgreSQL read.
    // MANDATORY ensures this lock is owned by the outer admission transaction and remains held
    // through quota reservation, revision creation, durable job creation, and outbox enqueue.
    storyboardRevisionAccess.lockChapter(chapterId);
    return chapterAnalysisSnapshotRepository.requireById(chapterId);
  }
}
