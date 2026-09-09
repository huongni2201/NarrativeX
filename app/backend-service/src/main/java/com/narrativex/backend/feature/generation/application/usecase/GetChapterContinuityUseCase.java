package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.query.ContinuityView;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetChapterContinuityUseCase {
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final ChapterContinuityRepository continuityRepository;

  @Transactional(readOnly = true)
  public ContinuityView execute(UUID projectId, UUID chapterId) {
    projectAccess.findOwnedProject(projectId, currentUserId.get());
    return continuityRepository
        .findCurrent(projectId, chapterId)
        .map(ContinuityView::from)
        .orElseThrow(() -> new ResourceNotFoundException("Continuity plan not found"));
  }
}
