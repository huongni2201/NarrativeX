package com.narrativex.backend.feature.storyboard.application.usecase;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DeleteChapterUseCaseTest {
  private static final UUID PROJECT_ID = UUID.randomUUID();
  private static final UUID STORY_VERSION_ID = UUID.randomUUID();
  private static final UUID CHAPTER_ID = UUID.randomUUID();

  @Mock private CurrentUserId currentUserId;
  @Mock private StoryVersionAccess storyVersionAccess;
  @Mock private ChapterRepository chapterRepository;

  @Test
  void verifiesProjectOwnershipBeforeDeletingChapter() {
    Chapter chapter =
        Chapter.rehydrate(
            CHAPTER_ID,
            0L,
            STORY_VERSION_ID,
            0,
            "Chapter 1",
            "Text",
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    when(currentUserId.get()).thenReturn("owner-1");
    when(chapterRepository.findById(CHAPTER_ID)).thenReturn(Optional.of(chapter));

    new DeleteChapterUseCase(currentUserId, storyVersionAccess, chapterRepository)
        .execute(PROJECT_ID, CHAPTER_ID);

    verify(storyVersionAccess).requireOwnedStoryVersion(PROJECT_ID, STORY_VERSION_ID, "owner-1");
    verify(chapterRepository).deleteById(CHAPTER_ID);
  }
}
