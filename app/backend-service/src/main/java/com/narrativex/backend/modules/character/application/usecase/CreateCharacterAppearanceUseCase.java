package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.CreateCharacterAppearanceCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.domain.model.CharacterAppearance;
import com.narrativex.backend.modules.character.domain.model.OutfitVersion;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.shared.error.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CreateCharacterAppearanceUseCase {
    private final CharacterRepository characterRepository;
    private final CharacterAppearanceRepository appearanceRepository;
    private final OutfitVersionRepository outfitVersionRepository;
    private final ProjectAccess projectAccess;
    private final CurrentUserId currentUserId;

    public CreateCharacterAppearanceUseCase(CharacterRepository characterRepository,
                                            CharacterAppearanceRepository appearanceRepository,
                                            OutfitVersionRepository outfitVersionRepository,
                                            ProjectAccess projectAccess,
                                            CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.appearanceRepository = appearanceRepository;
        this.outfitVersionRepository = outfitVersionRepository;
        this.projectAccess = projectAccess;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public CharacterAppearance execute(CreateCharacterAppearanceCommand command, String ownerId) {
        String resolvedOwnerId = currentUserId.resolve(ownerId);
        characterRepository.findOwnedById(command.characterId(), resolvedOwnerId)
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        if (command.projectId() != null) {
            projectAccess.findOwnedProject(command.projectId(), resolvedOwnerId);
        }
        OutfitVersion outfitVersion = null;
        if (command.outfitVersionId() != null) {
            outfitVersion = outfitVersionRepository.findOwnedById(command.outfitVersionId(), resolvedOwnerId)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit version not found"));
        }
        return appearanceRepository.save(CharacterAppearance.create(command.characterId(), command.projectId(),
            command.timelineKey(), command.ageState(), command.hairstyle(), command.injury(),
            command.wardrobeContext(), command.appearancePrompt(), outfitVersion));
    }
}
