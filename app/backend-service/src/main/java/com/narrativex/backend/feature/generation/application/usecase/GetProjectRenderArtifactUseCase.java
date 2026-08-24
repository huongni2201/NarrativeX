package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.out.ProjectRenderArtifactQueryRepository;
import com.narrativex.backend.feature.generation.application.query.ProjectRenderArtifactView;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetProjectRenderArtifactUseCase {
  private final CurrentUserId currentUserId;
  private final ProjectRenderArtifactQueryRepository repository;

  @Transactional(readOnly = true)
  public ProjectRenderArtifactView execute(UUID projectId, UUID jobId) {
    return repository
        .findByJobId(projectId, jobId, currentUserId.get())
        .orElseThrow(() -> new ResourceNotFoundException("Project render artifact not found"));
  }
}
