package com.narrativex.backend.modules.character.application.usecase;

import com.narrativex.backend.modules.character.application.command.AssignCharacterToProjectCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.modules.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssignCharacterToProjectUseCase {
    private final CharacterRepository characterRepository;
    private final CharacterVersionRepository versionRepository;
    private final ProjectCharacterRepository projectCharacterRepository;
    private final ProjectAccess projectAccess;
    private final CurrentUserId currentUserId;

    public AssignCharacterToProjectUseCase(CharacterRepository characterRepository,
            CharacterVersionRepository versionRepository,
            ProjectCharacterRepository projectCharacterRepository,
            ProjectAccess projectAccess, CurrentUserId currentUserId) {
        this.characterRepository = characterRepository;
        this.versionRepository = versionRepository;
        this.projectCharacterRepository = projectCharacterRepository;
        this.projectAccess = projectAccess;
        this.currentUserId = currentUserId;
    }

    @Transactional
    public ProjectCharacter execute(AssignCharacterToProjectCommand command, String ownerId) {
        String resolvedOwnerId = currentUserId.resolve(ownerId);
        projectAccess.findOwnedProject(command.projectId(), resolvedOwnerId);
        characterRepository.findOwnedById(command.characterId(), resolvedOwnerId)
                .orElseThrow(() -> new ResourceNotFoundException("Character not found"));
        ProjectCharacter assignment = ProjectCharacter.assign(command.projectId(), command.characterId(),
                command.role(), command.importance(), command.projectAliases(), command.storyMetadata(),
                command.groups(), null);
        if (command.pinnedCharacterVersionId() != null) {
            var version = versionRepository.findOwnedById(command.pinnedCharacterVersionId(), resolvedOwnerId)
                    .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
            assignment.pinVersion(version);
        }
        return projectCharacterRepository.save(assignment);
    }
}
