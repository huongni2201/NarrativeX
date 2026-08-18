package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.command.CreateCharacterAppearanceCommand;
import com.narrativex.backend.feature.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterRepository;
import com.narrativex.backend.feature.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateCharacterAppearanceUseCase {
  private final CharacterRepository characterRepository;
  private final CharacterAppearanceRepository appearanceRepository;
  private final OutfitVersionRepository outfitVersionRepository;
  private final ProjectAccess projectAccess;
  private final CurrentUserId currentUserId;

  @Transactional
  public ApiResponse<CharacterAppearance> execute(CreateCharacterAppearanceCommand command) {
    String ownerId = currentUserId.get();
    characterRepository
        .findOwnedById(command.characterId(), ownerId)
        .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
    if (command.projectId() != null) projectAccess.findOwnedProject(command.projectId(), ownerId);
    OutfitVersion outfitVersion =
        command.outfitVersionId() == null
            ? null
            : outfitVersionRepository
                .findOwnedById(command.outfitVersionId(), ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit version not found"));
    CharacterAppearance appearance =
        appearanceRepository.save(
            CharacterAppearance.create(
                command.characterId(),
                command.projectId(),
                command.timelineKey(),
                command.ageState(),
                command.hairstyle(),
                command.injury(),
                command.wardrobeContext(),
                command.appearancePrompt(),
                outfitVersion));
    return ApiResponse.success("Character appearance created successfully", appearance);
  }
}
