package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.CreateCharacterVersionCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.domain.model.CharacterVersion;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateCharacterVersionUseCase {
    private final CharacterRepository characterRepository;
    private final CharacterVersionRepository versionRepository;
    private final CurrentUserId currentUserId;

    public CreateCharacterVersionUseCase(CharacterRepository characterRepository,
                                         CharacterVersionRepository versionRepository,
                                         CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.versionRepository = versionRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public CharacterVersion execute(CreateCharacterVersionCommand command, String ownerId) {
        String resolvedOwnerId = currentUserId.resolve(ownerId);
        var character = characterRepository.findOwnedByIdForUpdate(command.characterId(), resolvedOwnerId)
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        int versionNumber = versionRepository.findMaxVersionNumberByCharacterId(character.getId()) + 1;
        return versionRepository.save(character.createVersion(versionNumber, command.bible(),
            command.visualPrompt(), command.masterAssetId(), command.referenceAssetIds()));
    }
}
