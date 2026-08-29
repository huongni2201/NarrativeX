package com.narrativex.backend.feature.generation.application.usecase;

import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository;
import com.narrativex.backend.feature.assets.application.port.out.VoiceReferenceAssetRepository.VoiceReferenceAsset;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetVoiceReferenceAssetUseCase {
  private final CurrentUserId currentUserId;
  private final VoiceReferenceAssetRepository repository;

  @Transactional(readOnly = true)
  public VoiceReferenceAsset execute(UUID id) {
    return repository
        .findOwned(currentUserId.get(), id)
        .orElseThrow(() -> new ResourceNotFoundException("Voice reference asset not found"));
  }

  @Transactional(readOnly = true)
  public List<VoiceReferenceAsset> list() {
    return repository.listOwned(currentUserId.get());
  }
}
