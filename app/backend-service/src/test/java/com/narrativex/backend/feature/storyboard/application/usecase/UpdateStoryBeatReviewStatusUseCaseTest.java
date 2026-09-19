package com.narrativex.backend.feature.storyboard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.StoryBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.domain.entity.StoryBeat;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class UpdateStoryBeatReviewStatusUseCaseTest {
  @Mock private StoryVersionAccess storyVersionAccess;
  @Mock private ChapterRepository chapterRepository;
  @Mock private StoryboardRepository storyboardRepository;
  @Mock private StoryboardRevisionAccess storyboardRevisionAccess;

  private UpdateStoryBeatReviewStatusUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase =
        new UpdateStoryBeatReviewStatusUseCase(
            storyVersionAccess,
            chapterRepository,
            storyboardRepository,
            storyboardRevisionAccess);
  }

  @Test
  void updatesReviewStatusSuccessfully() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();

    Chapter chapter =
        Chapter.rehydrate(
            chapterId,
            1L,
            storyVersionId,
            1,
            "Chapter 1",
            "Content",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

    when(chapterRepository.findById(chapterId)).thenReturn(Optional.of(chapter));

    StoryBeat updatedBeat =
        StoryBeat.rehydrate(
            storyBeatId,
            2L,
            sceneId,
            0,
            0,
            100,
            "{}",
            "Introduction",
            "Summary text",
            "HIGH",
            "[]",
            "{}",
            "APPROVED");

    when(storyboardRepository.updateStoryBeatReviewStatus(storyBeatId, "APPROVED", 1L))
        .thenReturn(updatedBeat);

    ApiResponse<StoryBeatResponse> response =
        useCase.execute(projectId, chapterId, storyBeatId, 1L, "APPROVED");

    assertNotNull(response);
    assertEquals("APPROVED", response.data().reviewStatus());
    assertEquals(2L, response.data().rowVersion());
    verify(storyboardRevisionAccess).lockChapter(chapterId);
    verify(storyVersionAccess).requireStoryVersion(projectId, storyVersionId);
  }

  @Test
  void throwsConflictWhenConcurrentModificationOccurs() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();

    Chapter chapter =
        Chapter.rehydrate(
            chapterId,
            1L,
            storyVersionId,
            1,
            "Chapter 1",
            "Content",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

    when(chapterRepository.findById(chapterId)).thenReturn(Optional.of(chapter));
    when(storyboardRepository.updateStoryBeatReviewStatus(storyBeatId, "APPROVED", 1L))
        .thenThrow(new OptimisticLockingFailureException("concurrent edit"));

    assertThrows(
        ResourceConflictException.class,
        () -> useCase.execute(projectId, chapterId, storyBeatId, 1L, "APPROVED"));
  }

  @Test
  void throwsNotFoundWhenChapterDoesNotExist() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyBeatId = UUID.randomUUID();

    when(chapterRepository.findById(chapterId)).thenReturn(Optional.empty());

    assertThrows(
        ResourceNotFoundException.class,
        () -> useCase.execute(projectId, chapterId, storyBeatId, 1L, "APPROVED"));
  }
}
