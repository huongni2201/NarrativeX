package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.ChapterContinuityRepository;
import com.narrativex.backend.feature.generation.application.query.ContinuityView;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetChapterContinuityUseCaseTest {

  @Test
  void readsContinuityWithoutAcquiringChapterWriteLock() {
    var currentUserId = mock(CurrentUserId.class);
    var projectAccess = mock(ProjectAccess.class);
    var continuityRepository = mock(ChapterContinuityRepository.class);
    var useCase =
        new GetChapterContinuityUseCase(currentUserId, projectAccess, continuityRepository);
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID planId = UUID.randomUUID();
    var current =
        new ChapterContinuityRepository.CurrentContinuity(
            planId, 2, "a".repeat(64), "PASS", 3, "[]");

    when(currentUserId.get()).thenReturn("user-1");
    when(continuityRepository.findCurrent(projectId, chapterId)).thenReturn(Optional.of(current));

    assertThat(useCase.execute(projectId, chapterId)).isEqualTo(ContinuityView.from(current));
    verify(projectAccess).findOwnedProject(projectId, "user-1");
    verify(continuityRepository).findCurrent(projectId, chapterId);
  }
}
