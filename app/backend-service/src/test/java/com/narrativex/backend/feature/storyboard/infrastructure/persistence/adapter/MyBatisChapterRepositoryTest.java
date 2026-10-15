package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterRow;
import java.time.Instant;
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
  void staleUpdateIsRejectedWhenTheCompareAndSetAffectsNoRows() {
    Chapter chapter =
        Chapter.rehydrate(CHAPTER_ID, 3L, STORY_VERSION_ID, 0, "Chapter 1", "hello", SOURCE_HASH);
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
    Chapter chapter =
        Chapter.rehydrate(CHAPTER_ID, 3L, STORY_VERSION_ID, 0, "Chapter 1", "hello", SOURCE_HASH);
    when(mapper.findById(CHAPTER_ID)).thenReturn(null);

    assertThrows(
        ResourceNotFoundException.class, () -> new MyBatisChapterRepository(mapper).save(chapter));

    verify(mapper, never()).update(any(ChapterRow.class));
  }

  @Test
  void deleteIsRejectedWithAReadableConflictWhileGenerationWorkIsActive() {
    when(mapper.hasActiveGenerationJobs(CHAPTER_ID)).thenReturn(true);

    DomainConflictException error =
        assertThrows(
            DomainConflictException.class,
            () -> new MyBatisChapterRepository(mapper).deleteById(CHAPTER_ID));

    assertEquals("RESOURCE_CONFLICT", error.getCode());
    assertEquals(
        "Chapter cannot be deleted while generation work is active; wait for it to finish or cancel it first",
        error.getMessage());
    verify(mapper, never()).deleteById(CHAPTER_ID);
  }

  @Test
  void deleteReportsConflictWhenAJobStartsBetweenTheCheckAndTheUpdate() {
    when(mapper.hasActiveGenerationJobs(CHAPTER_ID)).thenReturn(false, true);
    when(mapper.deleteById(CHAPTER_ID)).thenReturn(0);

    assertThrows(
        DomainConflictException.class,
        () -> new MyBatisChapterRepository(mapper).deleteById(CHAPTER_ID));
  }

  @Test
  void deleteSoftDeletesAnIdleChapter() {
    when(mapper.hasActiveGenerationJobs(CHAPTER_ID)).thenReturn(false);
    when(mapper.deleteById(CHAPTER_ID)).thenReturn(1);

    new MyBatisChapterRepository(mapper).deleteById(CHAPTER_ID);

    verify(mapper).clearChapterCreationIdempotency(CHAPTER_ID);
    verify(mapper).deleteById(CHAPTER_ID);
  }

  private static ChapterRow persistedChapter(
      UUID id, long rowVersion, String sourceText, String sourceHash) {
    return ChapterRow.builder()
        .id(id)
        .rowVersion(rowVersion)
        .createdAt(Instant.parse("2026-08-29T00:00:00Z"))
        .updatedAt(Instant.parse("2026-08-29T00:00:00Z"))
        .storyVersionId(STORY_VERSION_ID)
        .orderIndex(0)
        .title("Chapter 1")
        .sourceText(sourceText)
        .sourceHash(sourceHash)
        .status("DRAFT")
        .sourceStoryVersionId(STORY_VERSION_ID)
        .build();
  }
}
