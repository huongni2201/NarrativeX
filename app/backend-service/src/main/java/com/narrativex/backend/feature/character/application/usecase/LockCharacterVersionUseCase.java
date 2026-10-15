package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.command.ChangeCharacterVersionStatusCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterReferencePolicy;
import com.narrativex.backend.feature.character.domain.service.CharacterReferencePackPolicy;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LockCharacterVersionUseCase {
  private final CharacterVersionRepository versionRepository;
  private final CharacterVersionReferenceRepository referenceRepository;

  @Transactional
  public CharacterVersion execute(ChangeCharacterVersionStatusCommand command) {
    CharacterVersion version =
        versionRepository
            .findByIdForUpdate(command.characterVersionId())
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
    var references = referenceRepository.findByVersionId(command.characterVersionId());
    if (version.getReferencePolicy() == CharacterReferencePolicy.LEGACY_IDENTITY_V1) {
      boolean hasIdentityReference =
          references.stream().anyMatch(reference -> "IDENTITY".equalsIgnoreCase(reference.role()));
      if (!hasIdentityReference) {
        throw new ResourceConflictException(
            "Character version requires an IDENTITY reference before lock");
      }
    } else {
      var missingSlots = CharacterReferencePackPolicy.missingSlots(references);
      var duplicateSlots = CharacterReferencePackPolicy.duplicateSlots(references);
      boolean hasSlotlessReferences =
          CharacterReferencePackPolicy.hasSlotlessReferences(references);
      if (!missingSlots.isEmpty() || !duplicateSlots.isEmpty() || hasSlotlessReferences) {
        throw new ResourceConflictException(
            "Multi-view character version requires one active reference per slot; missing="
                + missingSlots
                + ", duplicates="
                + duplicateSlots
                + ", slotless="
                + hasSlotlessReferences);
      }
    }
    version.lock();
    CharacterVersion saved = versionRepository.save(version);
    log.info("Locked character version {}", command.characterVersionId());
    return saved;
  }
}
