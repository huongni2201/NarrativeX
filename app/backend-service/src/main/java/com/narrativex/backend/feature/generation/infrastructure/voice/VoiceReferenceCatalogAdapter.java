package com.narrativex.backend.feature.generation.infrastructure.voice;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.VoiceReferenceAsset;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.application.port.in.VoiceReferenceCatalog;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class VoiceReferenceCatalogAdapter implements VoiceReferenceCatalog {
  private final CurrentUserId currentUserId;
  private final VoiceReferenceAssetRepository repository;

  @Override
  @Transactional(readOnly = true)
  public VoiceReferenceView get(UUID id) {
    return toView(
        repository
            .findOwned(currentUserId.get(), id)
            .orElseThrow(() -> new ResourceNotFoundException("Voice reference asset not found")));
  }

  @Override
  @Transactional(readOnly = true)
  public List<VoiceReferenceView> list() {
    return repository.listOwned(currentUserId.get()).stream()
        .map(VoiceReferenceCatalogAdapter::toView)
        .toList();
  }

  private static VoiceReferenceView toView(VoiceReferenceAsset asset) {
    return new VoiceReferenceView(
        asset.id(),
        asset.originalFilename(),
        asset.contentType(),
        asset.sizeBytes(),
        asset.sha256(),
        asset.status());
  }
}
