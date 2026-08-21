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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectCharacterReadUseCasesTest {
  @Mock private ProjectCharacterReadRepository repository;

  private final CurrentUserId currentUserId = () -> "owner";

  @Test
  void listRejectsProjectOutsideCurrentOwner() {
    when(repository.projectOwnedBy(100L, "owner")).thenReturn(false);
    ListProjectCharactersUseCase useCase =
        new ListProjectCharactersUseCase(repository, currentUserId);

    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(100L, null, 20));
    verify(repository).projectOwnedBy(100L, "owner");
  }

  @Test
  void listReturnsAuthoritativeProjectProjection() {
    ProjectCharacterReadModel model = model();
    when(repository.projectOwnedBy(100L, "owner")).thenReturn(true);
    when(repository.findByProject(100L, "owner", null, 20))
        .thenReturn(new CursorPage<>(List.of(model), null, 20, false));
    ListProjectCharactersUseCase useCase =
        new ListProjectCharactersUseCase(repository, currentUserId);

    CursorPage<ProjectCharacterReadModel> page = useCase.execute(100L, null, 20);

    assertEquals(1, page.content().size());
    assertEquals("PROTAGONIST", page.content().getFirst().role());
    assertEquals(8, page.content().getFirst().sceneCount());
  }

  @Test
  void detailRejectsCharacterOutsideProject() {
    when(repository.projectOwnedBy(100L, "owner")).thenReturn(true);
    when(repository.findDetail(100L, 10L, "owner")).thenReturn(Optional.empty());
    GetProjectCharacterDetailUseCase useCase =
        new GetProjectCharacterDetailUseCase(repository, currentUserId);

    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(100L, 10L));
  }

  @Test
  void detailReturnsPinnedVersionAndAppearance() {
    ProjectCharacterReadModel model = model();
    when(repository.projectOwnedBy(100L, "owner")).thenReturn(true);
    when(repository.findDetail(100L, 10L, "owner")).thenReturn(Optional.of(model));
    GetProjectCharacterDetailUseCase useCase =
        new GetProjectCharacterDetailUseCase(repository, currentUserId);

    ProjectCharacterReadModel result = useCase.execute(100L, 10L);

    assertEquals(3, result.version().versionNumber());
    assertEquals("black hair", result.appearance().hairstyle());
    assertEquals(8, result.sceneCount());
  }

  private static ProjectCharacterReadModel model() {
    return new ProjectCharacterReadModel(
        200L,
        10L,
        100L,
        "workspace",
        "Lan",
        List.of("Lan"),
        List.of("Tieu Lan"),
        "PROTAGONIST",
        10,
        List.of("main-cast"),
        300L,
        "ACTIVE",
        8,
        4L,
        Instant.parse("2026-08-20T00:00:00Z"),
        Instant.parse("2026-08-21T00:00:00Z"),
        new ProjectCharacterReadModel.Version(3, "APPROVED", "bible", "prompt", 99L),
        new ProjectCharacterReadModel.Appearance(
            "adult", "black hair", null, "default outfit", "appearance prompt"));
  }
}
