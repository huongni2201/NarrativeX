package com.narrativex.backend.feature.assets.application.usecase;

import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import java.util.List;
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
  public List<MediaAssetView> list(String type, String status, String search) {
    return repository.list(currentUserId.get(), type, status, search);
  }

  @Transactional
  public MediaAssetView upload(MediaAssetRepository.CreateMediaAsset command) {
    return repository.create(currentUserId.get(), command);
  }

  @Transactional
  public MediaAssetView approve(UUID id) {
    return repository.approve(currentUserId.get(), id);
  }

  @Transactional
  public void delete(UUID id) {
    repository.delete(currentUserId.get(), id);
  }
}
