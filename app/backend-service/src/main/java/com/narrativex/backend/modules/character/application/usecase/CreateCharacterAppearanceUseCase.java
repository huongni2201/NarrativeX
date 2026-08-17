package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.character.application.command.CreateCharacterAppearanceCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterAppearanceRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.OutfitVersionRepository;
import com.narrativex.backend.modules.character.domain.aggregate.CharacterAppearance;
import com.narrativex.backend.modules.character.domain.aggregate.OutfitVersion;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.shared.application.response.ApiResponse;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;
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
            CharacterAppearanceRepository appearanceRepository, OutfitVersionRepository outfitVersionRepository,
            ProjectAccess projectAccess, CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.appearanceRepository = appearanceRepository;
        this.outfitVersionRepository = outfitVersionRepository;
        this.projectAccess = projectAccess;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public ApiResponse<CharacterAppearance> execute(CreateCharacterAppearanceCommand command) {
        String ownerId = currentUserId.resolve(command.ownerId());
        characterRepository.findOwnedById(command.characterId(), ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        if (command.projectId() != null) {
            projectAccess.findOwnedProject(command.projectId(), ownerId);
        }
        OutfitVersion outfitVersion = null;
        if (command.outfitVersionId() != null) {
            outfitVersion = outfitVersionRepository.findOwnedById(command.outfitVersionId(), ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit version not found"));
        }
        CharacterAppearance appearance = appearanceRepository.save(CharacterAppearance.create(command.characterId(),
            command.projectId(), command.timelineKey(), command.ageState(), command.hairstyle(), command.injury(),
            command.wardrobeContext(), command.appearancePrompt(), outfitVersion));
        return ApiResponse.success("Character appearance created successfully", appearance);
    }
}
