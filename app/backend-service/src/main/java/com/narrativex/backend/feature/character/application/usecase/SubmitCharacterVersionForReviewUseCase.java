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
public class SubmitCharacterVersionForReviewUseCase {
  private final CharacterVersionRepository versionRepository;
  private final CharacterVersionReferenceRepository referenceRepository;

  @Transactional
  public CharacterVersion execute(ChangeCharacterVersionStatusCommand command) {
    CharacterVersion version =
        versionRepository
            .findById(command.characterVersionId())
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
    if (version.getReferencePolicy() == CharacterReferencePolicy.MULTI_VIEW_V1) {
      var references = referenceRepository.findByVersionId(version.getId());
      var missingSlots = CharacterReferencePackPolicy.missingSlots(references);
      var duplicateSlots = CharacterReferencePackPolicy.duplicateSlots(references);
      if (!missingSlots.isEmpty()
          || !duplicateSlots.isEmpty()
          || CharacterReferencePackPolicy.hasSlotlessReferences(references)) {
        throw new ResourceConflictException(
            "Complete and review all eight reference slots before submitting the version");
      }
    }
    version.submitForReview();
    CharacterVersion saved = versionRepository.save(version);
    log.info("Submitted character version {} for review", command.characterVersionId());
    return saved;
  }
}
