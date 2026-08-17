package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.CreateOutfitVersionCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.domain.aggregate.OutfitVersion;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateOutfitVersionUseCase {
    private final CharacterRepository characterRepository;
    private final OutfitVersionRepository outfitVersionRepository;
    private final CurrentUserId currentUserId;

    public CreateOutfitVersionUseCase(CharacterRepository characterRepository,
            OutfitVersionRepository outfitVersionRepository,
            CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.outfitVersionRepository = outfitVersionRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public OutfitVersion execute(CreateOutfitVersionCommand command, String ownerId) {
        String resolvedOwnerId = currentUserId.resolve(ownerId);
        characterRepository.findOwnedByIdForUpdate(command.characterId(), resolvedOwnerId)
                .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        int versionNumber = outfitVersionRepository.findMaxVersionNumberByCharacterId(command.characterId()) + 1;
        return outfitVersionRepository.save(OutfitVersion.create(command.characterId(), versionNumber,
                command.name(), command.description(), command.prompt()));
    }
}
