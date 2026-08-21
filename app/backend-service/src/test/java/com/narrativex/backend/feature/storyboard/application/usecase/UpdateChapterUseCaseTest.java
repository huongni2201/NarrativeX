package com.narrativex.backend.feature.storyboard.application.usecase;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.command.UpdateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.service.ChapterSourceHasher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UpdateChapterUseCaseTest {
  @Mock private CurrentUserId currentUserId;
  @Mock private StoryVersionAccess storyVersionAccess;
  @Mock private ChapterRepository chapterRepository;
  @Mock private StoryboardRevisionAccess storyboardRevisionAccess;
  @Mock private ChapterSourceHasher sourceHasher;

  @Test
  void rejectsUnauthorizedChapterBeforeAcquiringSerializationLock() {
    var useCase =
        new UpdateChapterUseCase(
            currentUserId,
            storyVersionAccess,
            chapterRepository,
            storyboardRevisionAccess,
            sourceHasher,
            new NarrativeXLimitsProperties());
    var chapter = Chapter.rehydrate(11L, 2L, 9L, 0, "Chapter", "source", SOURCE_HASH);
    when(currentUserId.get()).thenReturn("user-b");
    when(chapterRepository.findById(11L)).thenReturn(java.util.Optional.of(chapter));
    doThrow(new ResourceNotFoundException("Story version not found"))
        .when(storyVersionAccess)
        .requireOwnedStoryVersion(7L, 9L, "user-b");

    assertThrows(
        ResourceNotFoundException.class,
        () ->
            useCase.execute(
                new UpdateChapterCommand(7L, 11L, 2L, "Updated", "updated source")));

    verify(storyboardRevisionAccess, never()).lockChapter(11L);
  }

  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
}
