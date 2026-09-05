package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetChapterContinuityUseCase {
  private final CurrentUserId currentUserId;
  private final ChapterAnalysisSourceAccess chapterSourceAccess;
  private final ChapterContinuityRepository continuityRepository;

  @Transactional(readOnly = true)
  public ChapterContinuityRepository.CurrentContinuity execute(UUID projectId, UUID chapterId) {
    chapterSourceAccess.requireOwnedForAnalysisLocked(
        projectId, chapterId, currentUserId.get());
    return continuityRepository
        .findCurrent(projectId, chapterId)
        .orElseThrow(() -> new ResourceNotFoundException("Continuity plan not found"));
  }
}
