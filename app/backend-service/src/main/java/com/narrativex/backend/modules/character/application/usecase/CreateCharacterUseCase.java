package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.CreateCharacterCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.shared.application.response.ApiResponse;
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
    public ApiResponse<Character> execute(CreateCharacterCommand command) {
        Character character = characterRepository.save(Character.create(currentUserId.resolve(command.ownerId()),
            command.workspaceId(), command.canonicalName(), command.aliases()));
        return ApiResponse.success("Character created successfully", character);
    }
}
