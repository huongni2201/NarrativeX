package com.narrativex.backend.modules.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.modules.character.application.command.AssignCharacterToProjectCommand;
import com.narrativex.backend.modules.character.application.port.out.CharacterRepository;
import com.narrativex.backend.modules.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.modules.character.application.port.out.ProjectCharacterRepository;
import com.narrativex.backend.modules.character.application.usecase.AssignCharacterToProjectUseCase;
import com.narrativex.backend.modules.character.domain.model.Character;
import com.narrativex.backend.modules.character.domain.model.CharacterStatus;
import com.narrativex.backend.modules.character.domain.model.ProjectCharacter;
import com.narrativex.backend.modules.project.application.port.in.ProjectAccess;
import com.narrativex.backend.modules.project.domain.model.AspectRatio;
import com.narrativex.backend.modules.project.domain.model.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.model.Project;
import com.narrativex.backend.modules.project.domain.model.ProjectStatus;
import com.narrativex.backend.shared.security.CurrentUserId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssignCharacterToProjectUseCaseTest {
    @Mock
    private CharacterRepository characterRepository;
    @Mock
    private CharacterVersionRepository versionRepository;
    @Mock
    private ProjectCharacterRepository projectCharacterRepository;
    @Mock
    private ProjectAccess projectAccess;

    @Test
    void assignmentUsesProjectAccessAndPersistsAnAssociation() {
        Character character = Character.rehydrate(10L, 0L, "owner", null, "Mina", java.util.List.of(),
            CharacterStatus.ACTIVE);
        Project project = Project.rehydrate(100L, 0L, "Story", "owner", ProjectStatus.DRAFT, "vi-VN",
            "vi-VN", "vi-VN", AspectRatio.RATIO_16_9, ImageQualityTier.STANDARD, null);
        when(projectAccess.findOwnedProject(100L, "owner")).thenReturn(project);
        when(characterRepository.findOwnedById(10L, "owner")).thenReturn(java.util.Optional.of(character));
        when(projectCharacterRepository.save(any(ProjectCharacter.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        AssignCharacterToProjectUseCase useCase = new AssignCharacterToProjectUseCase(characterRepository,
            versionRepository, projectCharacterRepository, projectAccess,
            new CurrentUserId(false, "local-dev-user"));
        ProjectCharacter result = useCase.execute(new AssignCharacterToProjectCommand(100L, 10L,
            "PROTAGONIST", 1, java.util.List.of(), null, java.util.List.of(), null), "owner");

        assertEquals(10L, result.getCharacterId());
        assertEquals(100L, result.getProjectId());
        verify(projectAccess).findOwnedProject(100L, "owner");
    }
}
