package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateOutfitVersionCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateOutfitVersionUseCase {
  private final CharacterRepository characterRepository;
  private final OutfitVersionRepository outfitVersionRepository;
  private final CurrentUserId currentUserId;

  @Transactional
  public ApiResponse<OutfitVersion> execute(CreateOutfitVersionCommand command) {
    String ownerId = currentUserId.get();
    characterRepository
        .findOwnedByIdForUpdate(command.characterId(), ownerId)
        .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    int versionNumber =
        outfitVersionRepository.findMaxVersionNumberByCharacterId(command.characterId()) + 1;
    OutfitVersion outfit =
        outfitVersionRepository.save(
            OutfitVersion.create(
                command.characterId(),
                versionNumber,
                command.name(),
                command.description(),
                command.prompt()));
    return ApiResponse.success("Outfit version created successfully", outfit);
  }
}
