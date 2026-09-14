package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.character.application.command.CreateOutfitVersionCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateOutfitVersionUseCase {
  private final CharacterRepository characterRepository;
  private final OutfitVersionRepository outfitVersionRepository;

  @Transactional
  public OutfitVersion execute(CreateOutfitVersionCommand command) {
    characterRepository
        .findByIdForUpdate(command.characterId())
        .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    int versionNumber =
        outfitVersionRepository.findMaxVersionNumberByCharacterId(command.characterId()) + 1;
    return outfitVersionRepository.save(
        OutfitVersion.create(
            command.characterId(),
            versionNumber,
            command.name(),
            command.description(),
            command.prompt()));
  }
}
