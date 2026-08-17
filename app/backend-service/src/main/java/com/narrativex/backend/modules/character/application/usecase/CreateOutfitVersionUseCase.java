package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.CreateOutfitVersionCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.domain.entity.OutfitVersion;
import com.narrativex.backend.modules.common.exception.ResourceNotFoundException;
import com.narrativex.backend.modules.common.response.ApiResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateOutfitVersionUseCase {
    private final CharacterRepository characterRepository;
    private final OutfitVersionRepository outfitVersionRepository;
    private final CurrentUserId currentUserId;
    public CreateOutfitVersionUseCase(CharacterRepository characterRepository, OutfitVersionRepository outfitVersionRepository, CurrentUserId currentUserId) { this.characterRepository = characterRepository; this.outfitVersionRepository = outfitVersionRepository; this.currentUserId = currentUserId; }
    @Transactional public ApiResponse<OutfitVersion> execute(CreateOutfitVersionCommand command) {
        String ownerId = currentUserId.resolve(command.ownerId());
        characterRepository.findOwnedByIdForUpdate(command.characterId(), ownerId).orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        int versionNumber = outfitVersionRepository.findMaxVersionNumberByCharacterId(command.characterId()) + 1;
        OutfitVersion outfit = outfitVersionRepository.save(OutfitVersion.create(command.characterId(), versionNumber, command.name(), command.description(), command.prompt()));
        return ApiResponse.success("Outfit version created successfully", outfit);
    }
}
