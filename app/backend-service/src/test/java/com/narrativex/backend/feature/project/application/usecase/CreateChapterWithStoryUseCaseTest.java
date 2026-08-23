package com.narrativex.backend.feature.project.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.command.CreateChapterWithStoryCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ChapterCreationIdempotencyRepository;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.project.domain.enums.ProjectStatus;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.usecase.CreateChapterUseCase;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CreateChapterWithStoryUseCaseTest {
  private final CurrentUserId currentUserId = org.mockito.Mockito.mock(CurrentUserId.class);
  private final ProjectAccess projectAccess = org.mockito.Mockito.mock(ProjectAccess.class);
  private final StoryVersionRepository storyVersions =
      org.mockito.Mockito.mock(StoryVersionRepository.class);
  private final CreateStoryVersionUseCase createStory =
      org.mockito.Mockito.mock(CreateStoryVersionUseCase.class);
  private final CreateChapterUseCase createChapter =
      org.mockito.Mockito.mock(CreateChapterUseCase.class);
  private final ChapterRepository chapters = org.mockito.Mockito.mock(ChapterRepository.class);
  private final ChapterCreationIdempotencyRepository idempotency =
      org.mockito.Mockito.mock(ChapterCreationIdempotencyRepository.class);
  private final CreateChapterWithStoryUseCase useCase =
      new CreateChapterWithStoryUseCase(
          currentUserId,
          projectAccess,
          storyVersions,
          createStory,
          createChapter,
          chapters,
          idempotency);

  @Test
  void createsStoryVersionAndChapterInsideTheSameApplicationWorkflow() {
    Project project = project();
    StoryVersion story =
        StoryVersion.rehydrate(
            11L,
            0L,
            7L,
            1,
            "Text",
            "vi-VN",
            com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus.DRAFT,
            com.narrativex.backend.feature.project.domain.enums.ModerationDecision.NOT_REQUIRED);
    ChapterResponse response =
        new ChapterResponse(21L, 11L, 0, "Chapter", "Text", "a".repeat(64), 0L);
    when(currentUserId.get()).thenReturn("owner");
    when(projectAccess.findOwnedProjectForUpdate(7L, "owner")).thenReturn(project);
    when(idempotency.reserve(anyString(), eq(7L), eq("key-1"), anyString()))
        .thenAnswer(
            invocation ->
                Optional.of(
                    new ChapterCreationIdempotencyRepository.Reservation(
                        1L, "owner", 7L, "key-1", (String) invocation.getArgument(3), null)));
    when(storyVersions.findActiveByProjectId(7L)).thenReturn(Optional.empty());
    when(storyVersions.findLatestByProjectId(7L)).thenReturn(Optional.empty());
    when(createStory.execute(any())).thenReturn(story);
    when(chapters.findMaxOrderIndexByStoryVersionId(11L)).thenReturn(-1);
    when(createChapter.execute(any())).thenReturn(ApiResponse.success("created", response));

    assertEquals(
        21L,
        useCase
            .execute(new CreateChapterWithStoryCommand(7L, null, null, "Chapter", "Text", "key-1"))
            .data()
            .id());

    verify(createStory).execute(any());
    verify(createChapter).execute(any());
    verify(idempotency).complete(1L, 21L);
  }

  @Test
  void reusesCompletedIdempotencyReservationWithoutCreatingAnotherChapter() {
    Chapter chapter = Chapter.rehydrate(21L, 0L, 11L, 0, "Chapter", "Text", "a".repeat(64));
    when(currentUserId.get()).thenReturn("owner");
    when(projectAccess.findOwnedProjectForUpdate(7L, "owner")).thenReturn(project());
    when(idempotency.reserve(anyString(), eq(7L), eq("key-1"), anyString()))
        .thenAnswer(
            invocation ->
                Optional.of(
                    new ChapterCreationIdempotencyRepository.Reservation(
                        1L, "owner", 7L, "key-1", (String) invocation.getArgument(3), 21L)));
    when(chapters.findById(21L)).thenReturn(Optional.of(chapter));

    assertEquals(
        21L,
        useCase
            .execute(new CreateChapterWithStoryCommand(7L, 11L, 0, "Chapter", "Text", "key-1"))
            .data()
            .id());

    verify(createChapter, never()).execute(any());
    verify(createStory, never()).execute(any());
  }

  private static Project project() {
    return Project.rehydrate(
        7L,
        0L,
        "Project",
        "owner",
        ProjectStatus.ACTIVE,
        "vi-VN",
        "vi-VN",
        "vi-VN",
        AspectRatio.RATIO_16_9,
        ImageQualityTier.STANDARD,
        null);
  }
}
