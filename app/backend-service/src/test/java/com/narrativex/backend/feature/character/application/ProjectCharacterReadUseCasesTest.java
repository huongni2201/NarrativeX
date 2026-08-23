package com.narrativex.backend.feature.character.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.ProjectCharacterReadRepository;
import com.narrativex.backend.feature.character.application.query.ProjectCharacterReadModel;
import com.narrativex.backend.feature.character.application.usecase.GetProjectCharacterDetailUseCase;
import com.narrativex.backend.feature.character.application.usecase.ListProjectCharactersUseCase;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.pagination.CursorPage;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectCharacterReadUseCasesTest {
  private static final UUID PROJECT_ID = UUID.fromString("00000000-0000-0000-0000-000000000100");
  private static final UUID CHARACTER_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
  private static final UUID ASSIGNMENT_ID = UUID.fromString("00000000-0000-0000-0000-000000000200");
  private static final UUID PINNED_VERSION_ID = UUID.fromString("00000000-0000-0000-0000-000000000300");
  private static final UUID APPEARANCE_ID = UUID.fromString("00000000-0000-0000-0000-000000000004");

  @Mock private ProjectCharacterReadRepository repository;

  private final CurrentUserId currentUserId = () -> "owner";

  @Test
  void listRejectsProjectOutsideCurrentOwner() {
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(false);
    ListProjectCharactersUseCase useCase =
        new ListProjectCharactersUseCase(repository, currentUserId);

    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(PROJECT_ID, null, 20));
    verify(repository).projectOwnedBy(PROJECT_ID, "owner");
  }

  @Test
  void listReturnsAuthoritativeProjectProjection() {
    ProjectCharacterReadModel model = model();
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(true);
    when(repository.findByProject(PROJECT_ID, "owner", null, 20))
        .thenReturn(new CursorPage<>(List.of(model), null, 20, false));
    ListProjectCharactersUseCase useCase =
        new ListProjectCharactersUseCase(repository, currentUserId);

    CursorPage<ProjectCharacterReadModel> page = useCase.execute(PROJECT_ID, null, 20);

    assertEquals(1, page.content().size());
    assertEquals("PROTAGONIST", page.content().getFirst().role());
    assertEquals(8, page.content().getFirst().sceneCount());
  }

  @Test
  void detailRejectsCharacterOutsideProject() {
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(true);
    when(repository.findDetail(PROJECT_ID, CHARACTER_ID, "owner")).thenReturn(Optional.empty());
    GetProjectCharacterDetailUseCase useCase =
        new GetProjectCharacterDetailUseCase(repository, currentUserId);

    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(PROJECT_ID, CHARACTER_ID));
  }

  @Test
  void detailReturnsPinnedVersionAndAppearance() {
    ProjectCharacterReadModel model = model();
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(true);
    when(repository.findDetail(PROJECT_ID, CHARACTER_ID, "owner")).thenReturn(Optional.of(model));
    GetProjectCharacterDetailUseCase useCase =
        new GetProjectCharacterDetailUseCase(repository, currentUserId);

    ProjectCharacterReadModel result = useCase.execute(PROJECT_ID, CHARACTER_ID);

    assertEquals(3, result.version().versionNumber());
    assertEquals("black hair", result.appearance().hairstyle());
    assertEquals(8, result.sceneCount());
  }

  private static ProjectCharacterReadModel model() {
    return new ProjectCharacterReadModel(
        ASSIGNMENT_ID,
        CHARACTER_ID,
        PROJECT_ID,
        "workspace",
        "Lan",
        List.of("Lan"),
        List.of("Tieu Lan"),
        "PROTAGONIST",
        10,
        List.of("main-cast"),
        PINNED_VERSION_ID,
        "ACTIVE",
        8,
        4L,
        Instant.parse("2026-08-20T00:00:00Z"),
        Instant.parse("2026-08-21T00:00:00Z"),
        new ProjectCharacterReadModel.Version(3, "APPROVED", "bible", "prompt"),
        new ProjectCharacterReadModel.Appearance(
            "adult", "black hair", null, "default outfit", "appearance prompt"));
  }
}
