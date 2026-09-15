package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository.CreateLocalMediaAsset;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AssetLibraryUseCase {
  private final ProjectAccess projectAccess;
  private final MediaAssetRepository repository;

  @Transactional(readOnly = true)
  public CursorPage<MediaAssetView> list(
      UUID projectId, String type, String status, String search, String cursor, int limit) {
    projectAccess.findProject(projectId);
    return repository.list(projectId, type, status, search, cursor, limit);
  }

  @Transactional(readOnly = true)
  public MediaAssetView find(UUID projectId, UUID id) {
    projectAccess.findProject(projectId);
    return repository.findById(projectId, id);
  }

  @Transactional
  public MediaAssetView registerLocal(
      UUID projectId,
      String type,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String checksumSha256,
      Long durationMs) {
    projectAccess.findProject(projectId);
    return repository.createLocalAsset(
        new CreateLocalMediaAsset(
            UuidV7.random(),
            projectId,
            type,
            originalFilename,
            contentType,
            sizeBytes,
            checksumSha256,
            durationMs));
  }

  @Transactional
  public void delete(UUID projectId, UUID id) {
    projectAccess.findProject(projectId);
    repository.delete(projectId, id);
  }
}
