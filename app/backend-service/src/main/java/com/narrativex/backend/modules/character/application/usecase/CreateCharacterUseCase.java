package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.CreateCharacterCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateCharacterUseCase {
    private final CharacterRepository characterRepository;
    private final CurrentUserId currentUserId;

    public CreateCharacterUseCase(CharacterRepository characterRepository, CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public Character execute(CreateCharacterCommand command, String ownerId) {
        return characterRepository.save(Character.create(currentUserId.resolve(ownerId), command.workspaceId(),
            command.canonicalName(), command.aliases()));
    }
}
