package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class MyBatisChapterRepositoryTest {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  @Mock private ChapterMapper mapper;

  @Test
  void insertsAndReloadsTheCompleteChapterDomainState() {
    Chapter chapter = new Chapter(7L, 0, "Chapter 1", "hello", SOURCE_HASH);
    when(mapper.insert(any(ChapterRow.class))).thenReturn(11L);
    when(mapper.findById(11L)).thenReturn(persistedChapter(11L, 0L, "hello", SOURCE_HASH));

    Chapter saved = new MyBatisChapterRepository(mapper).saveAndFlush(chapter);

    assertEquals(11L, saved.getId());
    assertEquals(7L, saved.getStoryVersionId());
    assertEquals("hello", saved.getSourceText());
    assertEquals(SOURCE_HASH, saved.getSourceHash());
    assertEquals(0L, saved.getRowVersion());
  }

  @Test
  void staleUpdateIsRejectedWhenTheCompareAndSetAffectsNoRows() {
    Chapter chapter = Chapter.rehydrate(11L, 3L, 7L, 0, "Chapter 1", "hello", SOURCE_HASH);
    ChapterRow persisted = persistedChapter(11L, 4L, "server", SOURCE_HASH);
    when(mapper.findById(11L)).thenReturn(persisted);
    when(mapper.update(any(ChapterRow.class))).thenReturn(0);

    assertThrows(
        ObjectOptimisticLockingFailureException.class,
        () -> new MyBatisChapterRepository(mapper).saveAndFlush(chapter));

    verify(mapper).update(any(ChapterRow.class));
  }

  @Test
  void existingChapterCannotBeSilentlyRecreatedWhenMissing() {
    Chapter chapter = Chapter.rehydrate(11L, 3L, 7L, 0, "Chapter 1", "hello", SOURCE_HASH);
    when(mapper.findById(11L)).thenReturn(null);

    assertThrows(
        ResourceNotFoundException.class,
        () -> new MyBatisChapterRepository(mapper).save(chapter));

    verify(mapper, never()).update(any(ChapterRow.class));
  }

  private static ChapterRow persistedChapter(
      long id, long rowVersion, String sourceText, String sourceHash) {
    return ChapterRow.builder()
        .id(id)
        .rowVersion(rowVersion)
        .storyVersionId(7L)
        .orderIndex(0)
        .title("Chapter 1")
        .sourceText(sourceText)
        .sourceHash(sourceHash)
        .status("DRAFT")
        .generationProgress(0)
        .sourceStoryVersionId(7L)
        .build();
  }
}
