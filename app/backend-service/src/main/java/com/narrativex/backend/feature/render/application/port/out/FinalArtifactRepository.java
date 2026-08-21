package com.narrativex.backend.feature.render.application.port.out;

import com.narrativex.backend.feature.render.application.query.FinalArtifactView;

public interface FinalArtifactRepository {
  FinalArtifactView findOwned(Long artifactId, String ownerId);
}
