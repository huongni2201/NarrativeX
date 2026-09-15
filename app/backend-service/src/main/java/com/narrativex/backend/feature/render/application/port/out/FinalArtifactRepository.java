package com.narrativex.backend.feature.render.application.port.out;

import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import java.util.Optional;

public interface FinalArtifactRepository {
  FinalArtifactView findById(Long artifactId);

  Optional<FinalArtifactView> findByGenerationJobId(String jobId);
}
