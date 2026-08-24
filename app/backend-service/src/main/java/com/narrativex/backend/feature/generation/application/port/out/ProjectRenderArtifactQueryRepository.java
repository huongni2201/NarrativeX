package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.query.ProjectRenderArtifactView;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRenderArtifactQueryRepository {
  Optional<ProjectRenderArtifactView> findByJobId(UUID projectId, UUID jobId, String ownerId);
}
