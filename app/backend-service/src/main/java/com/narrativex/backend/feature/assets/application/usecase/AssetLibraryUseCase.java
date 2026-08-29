package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository.CreateLocalMediaAsset;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
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
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final MediaAssetRepository repository;

  @Transactional(readOnly = true)
  public CursorPage<MediaAssetView> list(
      UUID projectId, String type, String status, String search, String cursor, int limit) {
    String ownerId = currentUserId.get();
    projectAccess.findOwnedProject(projectId, ownerId);
    return repository.list(ownerId, projectId, type, status, search, cursor, limit);
  }

  @Transactional(readOnly = true)
  public MediaAssetView find(UUID projectId, UUID id) {
    String ownerId = currentUserId.get();
    projectAccess.findOwnedProject(projectId, ownerId);
    return repository.findOwned(ownerId, projectId, id);
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
    String ownerId = currentUserId.get();
    projectAccess.findOwnedProject(projectId, ownerId);
    return repository.createLocalAsset(
        ownerId,
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
    String ownerId = currentUserId.get();
    projectAccess.findOwnedProject(projectId, ownerId);
    repository.delete(ownerId, projectId, id);
  }
}
