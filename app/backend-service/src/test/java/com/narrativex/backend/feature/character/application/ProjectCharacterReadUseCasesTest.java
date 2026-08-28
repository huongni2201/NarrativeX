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
import com.narrativex.backend.feature.common.uuid.UuidV7;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectCharacterReadUseCasesTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID CHARACTER_ID = UuidV7.random();
  private static final UUID ASSIGNMENT_ID = UuidV7.random();
  private static final UUID PINNED_VERSION_ID = UuidV7.random();

  @Mock private ProjectCharacterReadRepository repository;

  private final CurrentUserId currentUserId = () -> "owner";
  private ListProjectCharactersUseCase listUseCase;
  private GetProjectCharacterDetailUseCase detailUseCase;

  @BeforeEach
  void setUp() {
    listUseCase = new ListProjectCharactersUseCase(repository, currentUserId);
    detailUseCase = new GetProjectCharacterDetailUseCase(repository, currentUserId);
  }

  @Test
  void listRequiresOwnedProjectAndReturnsRepositoryPage() {
    CursorPage<ProjectCharacterReadModel> page =
        new CursorPage<>(List.of(model()), "next", 20, true);
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(true);
    when(repository.findByProject(PROJECT_ID, "owner", null, 20)).thenReturn(page);

    var result = listUseCase.execute(PROJECT_ID, null, 20);

    assertEquals(page, result);
    verify(repository).findByProject(PROJECT_ID, "owner", null, 20);
  }

  @Test
  void listRejectsUnknownProject() {
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(false);

    assertThrows(
        ResourceNotFoundException.class, () -> listUseCase.execute(PROJECT_ID, null, 20));
  }

  @Test
  void detailRequiresOwnedProjectAndCharacterAssignment() {
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(true);
    when(repository.findDetail(PROJECT_ID, CHARACTER_ID, "owner"))
        .thenReturn(Optional.empty());

    assertThrows(
        ResourceNotFoundException.class,
        () -> detailUseCase.execute(PROJECT_ID, CHARACTER_ID));
  }

  @Test
  void detailReturnsReadModel() {
    when(repository.projectOwnedBy(PROJECT_ID, "owner")).thenReturn(true);
    when(repository.findDetail(PROJECT_ID, CHARACTER_ID, "owner"))
        .thenReturn(Optional.of(model()));

    var result = detailUseCase.execute(PROJECT_ID, CHARACTER_ID);

    assertEquals(CHARACTER_ID, result.characterId());
    assertEquals(PINNED_VERSION_ID, result.pinnedCharacterVersionId());
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
        new ProjectCharacterReadModel.Version(
            PINNED_VERSION_ID, 3, "APPROVED", "bible", "prompt"),
        new ProjectCharacterReadModel.Appearance(
            "adult", "black hair", null, "default outfit", "appearance prompt"));
  }
}
