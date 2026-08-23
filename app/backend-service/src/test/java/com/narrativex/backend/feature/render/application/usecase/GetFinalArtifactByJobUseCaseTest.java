package com.narrativex.backend.feature.render.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.render.application.port.out.FinalArtifactRepository;
import com.narrativex.backend.feature.render.application.query.FinalArtifactView;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetFinalArtifactByJobUseCaseTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();
  private static final Long ARTIFACT_ID = 9911L;
  private static final String JOB_ID = "00000000-0000-4000-8000-000000009911";

  private final CurrentUserId currentUserId = mock(CurrentUserId.class);
  private final ProjectAccess projectAccess = mock(ProjectAccess.class);
  private final FinalArtifactRepository repository = mock(FinalArtifactRepository.class);
  private final GetFinalArtifactByJobUseCase useCase =
      new GetFinalArtifactByJobUseCase(currentUserId, projectAccess, repository);

  @Test
  void returnsReadyArtifactAfterVerifyingProjectOwnership() {
    FinalArtifactView artifact = artifact(ARTIFACT_ID, PROJECT_ID);
    when(currentUserId.get()).thenReturn("owner-1");
    when(repository.findByGenerationJobId(JOB_ID)).thenReturn(Optional.of(artifact));

    assertEquals(artifact, useCase.execute(JOB_ID));

    verify(projectAccess).findOwnedProject(PROJECT_ID, "owner-1");
  }

  @Test
  void hidesMissingArtifactAsNotFound() {
    when(repository.findByGenerationJobId(JOB_ID)).thenReturn(Optional.empty());

    assertThrows(ResourceNotFoundException.class, () -> useCase.execute(JOB_ID));

    verifyNoInteractions(projectAccess, currentUserId);
  }

  private static FinalArtifactView artifact(Long id, UUID projectId) {
    return new FinalArtifactView(
        id,
        projectId,
        CHAPTER_ID,
        "CHAPTER_VIDEO",
        "fingerprint",
        "storage-key",
        "GOOGLE_DRIVE",
        "external-id",
        null,
        "video/mp4",
        100L,
        "checksum",
        456L,
        1920,
        1080,
        "READY",
        Instant.parse("2026-08-19T00:00:00Z"),
        Instant.parse("2026-08-19T00:00:00Z"));
  }
}
