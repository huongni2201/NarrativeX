package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository.Reference;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GetCharacterVersionReferencesUseCase {
  private final CurrentUserId currentUserId;
  private final CharacterVersionRepository versionRepository;
  private final CharacterVersionReferenceRepository referenceRepository;

  @Transactional(readOnly = true)
  public List<Reference> execute(UUID characterId, UUID versionId) {
    var version =
        versionRepository
            .findOwnedById(versionId, currentUserId.get())
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
    if (!version.getCharacterId().equals(characterId)) {
      throw new ResourceNotFoundException("Character version not found");
    }
    return referenceRepository.findByVersionId(versionId);
  }
}
