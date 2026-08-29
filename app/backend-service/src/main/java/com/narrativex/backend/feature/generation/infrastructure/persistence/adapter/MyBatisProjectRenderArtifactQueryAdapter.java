package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProjectRenderArtifactQueryRepository;
import com.narrativex.backend.feature.generation.application.query.ProjectRenderArtifactView;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProjectRenderArtifactMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisProjectRenderArtifactQueryAdapter
    implements ProjectRenderArtifactQueryRepository {
  private final ProjectRenderArtifactMapper mapper;

  @Override
  public Optional<ProjectRenderArtifactView> findByJobId(
      UUID projectId, UUID jobId, String ownerId) {
    var row = mapper.findByJobId(projectId, jobId, ownerId);
    if (row == null) return Optional.empty();
    return Optional.of(
        new ProjectRenderArtifactView(
            row.getId(),
            row.getProjectId(),
            row.getGenerationJobId(),
            row.getStorageKey(),
            row.getMimeType(),
            row.getSizeBytes(),
            row.getChecksumSha256(),
            row.getDurationMs(),
            row.getWidth(),
            row.getHeight(),
            row.getFps(),
            row.getStatus()));
  }
}
