package com.narrativex.backend.feature.storyboard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterWithStoryCommand;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterCreationIdempotencyRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CreateChapterWithStoryUseCaseTest {
  private final CurrentUserId currentUserId = org.mockito.Mockito.mock(CurrentUserId.class);
  private final StoryVersionAccess storyVersionAccess =
      org.mockito.Mockito.mock(StoryVersionAccess.class);
  private final CreateChapterUseCase createChapter =
      org.mockito.Mockito.mock(CreateChapterUseCase.class);
  private final ChapterRepository chapters = org.mockito.Mockito.mock(ChapterRepository.class);
  private final ChapterCreationIdempotencyRepository idempotency =
      org.mockito.Mockito.mock(ChapterCreationIdempotencyRepository.class);
  private final CreateChapterWithStoryUseCase useCase =
      new CreateChapterWithStoryUseCase(
          currentUserId, storyVersionAccess, createChapter, chapters, idempotency);

  private static final UUID RESERVATION_ID = UuidV7.random();
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID STORY_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();

  @Test
  void createsStoryVersionAndChapterInsideTheSameApplicationWorkflow() {
    ChapterResponse response =
        new ChapterResponse(CHAPTER_ID, STORY_ID, 0, "Chapter", "Text", "a".repeat(64), 0L);
    when(currentUserId.get()).thenReturn("owner");
    when(storyVersionAccess.resolveOrCreateStoryVersion(PROJECT_ID, "owner", "Text"))
        .thenReturn(STORY_ID);
    when(idempotency.reserve(anyString(), eq(PROJECT_ID), eq("key-1"), anyString()))
        .thenAnswer(
            invocation ->
                Optional.of(
                    new ChapterCreationIdempotencyRepository.Reservation(
                        RESERVATION_ID,
                        "owner",
                        PROJECT_ID,
                        "key-1",
                        (String) invocation.getArgument(3),
                        null)));
    when(chapters.findMaxOrderIndexByStoryVersionId(STORY_ID)).thenReturn(-1);
    when(createChapter.execute(any())).thenReturn(ApiResponse.success("created", response));

    assertEquals(
        CHAPTER_ID,
        useCase
            .execute(
                new CreateChapterWithStoryCommand(
                    PROJECT_ID, null, null, "Chapter", "Text", "key-1"))
            .data()
            .id());

    verify(createChapter).execute(any());
    verify(idempotency).complete(RESERVATION_ID, CHAPTER_ID);
  }

  @Test
  void reusesCompletedIdempotencyReservationWithoutCreatingAnotherChapter() {
    Chapter chapter =
        Chapter.rehydrate(CHAPTER_ID, 0L, STORY_ID, 0, "Chapter", "Text", "a".repeat(64));
    when(currentUserId.get()).thenReturn("owner");
    when(idempotency.reserve(anyString(), eq(PROJECT_ID), eq("key-1"), anyString()))
        .thenAnswer(
            invocation ->
                Optional.of(
                    new ChapterCreationIdempotencyRepository.Reservation(
                        RESERVATION_ID,
                        "owner",
                        PROJECT_ID,
                        "key-1",
                        (String) invocation.getArgument(3),
                        CHAPTER_ID)));
    when(chapters.findById(CHAPTER_ID)).thenReturn(Optional.of(chapter));

    assertEquals(
        CHAPTER_ID,
        useCase
            .execute(
                new CreateChapterWithStoryCommand(
                    PROJECT_ID, STORY_ID, 0, "Chapter", "Text", "key-1"))
            .data()
            .id());

    verify(createChapter, never()).execute(any());
  }
}
