package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.CreateCharacterAppearanceCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.domain.model.CharacterAppearance;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateCharacterAppearanceUseCase {
    private final CharacterRepository characterRepository;
    private final CharacterAppearanceRepository appearanceRepository;
    private final CurrentUserId currentUserId;

    public CreateCharacterAppearanceUseCase(CharacterRepository characterRepository,
                                            CharacterAppearanceRepository appearanceRepository,
                                            CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.appearanceRepository = appearanceRepository;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public CharacterAppearance execute(CreateCharacterAppearanceCommand command, String ownerId) {
        characterRepository.findOwnedById(command.characterId(), currentUserId.resolve(ownerId))
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        return appearanceRepository.save(CharacterAppearance.create(command.characterId(), command.projectId(),
            command.timelineKey(), command.ageState(), command.hairstyle(), command.injury(),
            command.wardrobeContext(), command.appearancePrompt(), command.outfitVersionId()));
    }
}
