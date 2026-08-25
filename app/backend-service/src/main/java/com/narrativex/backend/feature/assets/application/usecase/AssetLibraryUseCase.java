package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository.CreateLocalMediaAsset;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AssetLibraryUseCase {
  private final CurrentUserId currentUserId;
  private final MediaAssetRepository repository;

  @Transactional(readOnly = true)
  public CursorPage<MediaAssetView> list(
      String type, String status, String search, String cursor, int limit) {
    return repository.list(currentUserId.get(), type, status, search, cursor, limit);
  }

  @Transactional(readOnly = true)
  public MediaAssetView find(UUID id) {
    return repository.findOwned(currentUserId.get(), id);
  }

  @Transactional
  public MediaAssetView registerLocal(
      String type,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String checksumSha256,
      Long durationMs) {
    return repository.createLocalAsset(
        currentUserId.get(),
        new CreateLocalMediaAsset(
            UuidV7.random(), type, originalFilename, contentType, sizeBytes, checksumSha256, durationMs));
  }

  @Transactional
  public MediaAssetView startUpload(UUID id) {
    return repository.startUpload(currentUserId.get(), id);
  }

  @Transactional
  public MediaAssetView startValidation(UUID id) {
    return repository.startValidation(currentUserId.get(), id);
  }

  @Transactional
  public MediaAssetView reject(UUID id) {
    return repository.reject(currentUserId.get(), id);
  }

  @Transactional
  public void delete(UUID id) {
    repository.delete(currentUserId.get(), id);
  }
}
