package com.narrativex.backend.feature.render.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactRepository;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import com.narrativex.backend.feature.render.infrastructure.persistence.mybatis.FinalArtifactMapper;
import com.narrativex.backend.feature.render.infrastructure.persistence.mybatis.FinalArtifactRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisFinalArtifactRepository implements FinalArtifactRepository {
  private final FinalArtifactMapper mapper;

  @Override
  public FinalArtifactView findOwned(Long artifactId, String ownerId) {
    FinalArtifactRow row = mapper.findOwned(artifactId, ownerId);
    if (row == null) {
      throw new ResourceNotFoundException("Final artifact not found");
    }
    return new FinalArtifactView(
        row.getId(), row.getProjectId(), row.getChapterId(), row.getArtifactType(),
        row.getRenderFingerprint(), row.getStorageKey(), row.getMimeType(), row.getSizeBytes(),
        row.getChecksumSha256(), row.getDurationMs(), row.getWidth(), row.getHeight(), row.getStatus(),
        row.getCreatedAt(), row.getUpdatedAt());
  }
}
