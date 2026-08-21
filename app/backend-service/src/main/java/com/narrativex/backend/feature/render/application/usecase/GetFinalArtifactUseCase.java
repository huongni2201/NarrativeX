package com.narrativex.backend.feature.render.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactRepository;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetFinalArtifactUseCase {
  private final CurrentUserId currentUserId;
  private final FinalArtifactRepository repository;

  @Transactional(readOnly = true)
  public FinalArtifactView execute(Long artifactId) {
    return repository.findOwned(artifactId, currentUserId.get());
  }
}
