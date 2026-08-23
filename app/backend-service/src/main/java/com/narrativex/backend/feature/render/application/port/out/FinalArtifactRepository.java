package com.narrativex.backend.feature.render.application.port.out;

import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import java.util.Optional;

public interface FinalArtifactRepository {
  FinalArtifactView findOwned(Long artifactId, String ownerId);

  Optional<FinalArtifactView> findByGenerationJobId(String jobId);
}
