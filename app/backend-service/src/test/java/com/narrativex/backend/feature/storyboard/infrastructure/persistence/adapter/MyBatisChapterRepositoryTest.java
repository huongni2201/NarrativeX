package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class MyBatisChapterRepositoryTest {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
  private static final UUID STORY_VERSION_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();

  @Mock private ChapterMapper mapper;

  @Test
  void insertsAndReloadsTheCompleteChapterDomainState() {
    Chapter chapter = new Chapter(STORY_VERSION_ID, 0, "Chapter 1", "hello", SOURCE_HASH);
    when(mapper.insert(any(ChapterRow.class))).thenReturn(CHAPTER_ID);
    when(mapper.findById(CHAPTER_ID)).thenReturn(persistedChapter(CHAPTER_ID, 0L, "hello", SOURCE_HASH));

    Chapter saved = new MyBatisChapterRepository(mapper).saveAndFlush(chapter);

    assertEquals(CHAPTER_ID, saved.getId());
    assertEquals(STORY_VERSION_ID, saved.getStoryVersionId());
    assertEquals("hello", saved.getSourceText());
    assertEquals(SOURCE_HASH, saved.getSourceHash());
    assertEquals(0L, saved.getRowVersion());
  }

  @Test
  void staleUpdateIsRejectedWhenTheCompareAndSetAffectsNoRows() {
    Chapter chapter = Chapter.rehydrate(CHAPTER_ID, 3L, STORY_VERSION_ID, 0, "Chapter 1", "hello", SOURCE_HASH);
    ChapterRow persisted = persistedChapter(CHAPTER_ID, 4L, "server", SOURCE_HASH);
    when(mapper.findById(CHAPTER_ID)).thenReturn(persisted);
    when(mapper.update(any(ChapterRow.class))).thenReturn(0);

    assertThrows(
        OptimisticLockingFailureException.class,
        () -> new MyBatisChapterRepository(mapper).saveAndFlush(chapter));

    verify(mapper).update(any(ChapterRow.class));
  }

  @Test
  void existingChapterCannotBeSilentlyRecreatedWhenMissing() {
    Chapter chapter = Chapter.rehydrate(CHAPTER_ID, 3L, STORY_VERSION_ID, 0, "Chapter 1", "hello", SOURCE_HASH);
    when(mapper.findById(CHAPTER_ID)).thenReturn(null);

    assertThrows(
        ResourceNotFoundException.class, () -> new MyBatisChapterRepository(mapper).save(chapter));

    verify(mapper, never()).update(any(ChapterRow.class));
  }

  private static ChapterRow persistedChapter(
      UUID id, long rowVersion, String sourceText, String sourceHash) {
    return ChapterRow.builder()
        .id(id)
        .rowVersion(rowVersion)
        .storyVersionId(STORY_VERSION_ID)
        .orderIndex(0)
        .title("Chapter 1")
        .sourceText(sourceText)
        .sourceHash(sourceHash)
        .status("DRAFT")
        .generationProgress(0)
        .sourceStoryVersionId(STORY_VERSION_ID)
        .build();
  }
}
