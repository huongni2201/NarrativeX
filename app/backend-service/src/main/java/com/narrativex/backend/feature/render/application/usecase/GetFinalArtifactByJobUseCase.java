package com.narrativex.backend.feature.render.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactRepository;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetFinalArtifactByJobUseCase {
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final FinalArtifactRepository repository;

  @Transactional(readOnly = true)
  public FinalArtifactView execute(String jobId) {
    FinalArtifactView artifact =
        repository
            .findByGenerationJobId(jobId)
            .orElseThrow(() -> new ResourceNotFoundException("Final artifact not found"));

    projectAccess.findOwnedProject(artifact.projectId(), currentUserId.get());
    return artifact;
  }
}
