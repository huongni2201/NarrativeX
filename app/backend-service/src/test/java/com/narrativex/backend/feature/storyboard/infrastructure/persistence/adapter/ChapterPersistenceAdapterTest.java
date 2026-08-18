package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.ChapterJpaEntity;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository.ChapterJpaRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class ChapterPersistenceAdapterTest {
  private static final String SOURCE_HASH =
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

  @Mock private ChapterJpaRepository repository;

  @Test
  void rejectsDetachedChapterWhenPersistedVersionMovedForward() {
    Chapter chapter = Chapter.rehydrate(11L, 3L, 7L, 0, "Chapter 1", "hello", SOURCE_HASH);
    ChapterJpaEntity persisted = persistedChapter(4L);
    when(repository.findById(11L)).thenReturn(Optional.of(persisted));
    ChapterPersistenceAdapter adapter = new ChapterPersistenceAdapter(repository);

    assertThrows(ObjectOptimisticLockingFailureException.class, () -> adapter.saveAndFlush(chapter));

    verify(repository, never()).saveAndFlush(persisted);
  }

  @Test
  void persistedChapterCannotBeSilentlyRecreatedWhenMissing() {
    Chapter chapter = Chapter.rehydrate(11L, 3L, 7L, 0, "Chapter 1", "hello", SOURCE_HASH);
    when(repository.findById(11L)).thenReturn(Optional.empty());
    ChapterPersistenceAdapter adapter = new ChapterPersistenceAdapter(repository);

    assertThrows(ResourceNotFoundException.class, () -> adapter.save(chapter));
  }

  private static ChapterJpaEntity persistedChapter(long rowVersion) {
    ChapterJpaEntity entity =
        ChapterJpaEntity.builder()
            .storyVersionId(7L)
            .orderIndex(0)
            .title("Chapter 1")
            .sourceText("server")
            .sourceHash(SOURCE_HASH)
            .status("DRAFT")
            .generationProgress(0)
            .sourceStoryVersionId(7L)
            .build();
    entity.setId(11L);
    entity.setRowVersion(rowVersion);
    return entity;
  }
}
