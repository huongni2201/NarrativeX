package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.domain.entity.CharacterVersion;
import com.narrativex.backend.modules.common.exception.ResourceNotFoundException;
import com.narrativex.backend.modules.common.response.ApiResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateCharacterVersionUseCase {
    private final CharacterRepository characterRepository;
    private final CharacterVersionRepository versionRepository;
    private final CurrentUserId currentUserId;
    public CreateCharacterVersionUseCase(CharacterRepository characterRepository, CharacterVersionRepository versionRepository, CurrentUserId currentUserId) { this.characterRepository = characterRepository; this.versionRepository = versionRepository; this.currentUserId = currentUserId; }
    @Transactional public ApiResponse<CharacterVersion> execute(CreateCharacterVersionCommand command) {
        String ownerId = currentUserId.resolve(command.ownerId());
        var character = characterRepository.findOwnedByIdForUpdate(command.characterId(), ownerId).orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        int versionNumber = versionRepository.findMaxVersionNumberByCharacterId(character.getId()) + 1;
        CharacterVersion version = versionRepository.save(character.createVersion(versionNumber, command.bible(), command.visualPrompt(), command.masterAssetId(), command.referenceAssetIds()));
        return ApiResponse.success("Character version created successfully", version);
    }
}
