package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.entity.StoryVersionJpaEntity;
import com.narrativex.backend.feature.project.infrastructure.persistence.repository.StoryVersionJpaRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class StoryVersionPersistenceAdapterTest {
  @Mock private StoryVersionJpaRepository repository;

  @Test
  void rejectsDetachedStoryVersionWhenPersistedVersionMovedForward() {
    StoryVersion storyVersion =
        StoryVersion.rehydrate(
            11L,
            3L,
            7L,
            1,
            "content",
            "vi-VN",
            StoryVersionStatus.DRAFT,
            ModerationDecision.PENDING);
    StoryVersionJpaEntity persisted = persistedStoryVersion(4L);
    when(repository.findById(11L)).thenReturn(Optional.of(persisted));
    StoryVersionPersistenceAdapter adapter = new StoryVersionPersistenceAdapter(repository);

    assertThrows(ObjectOptimisticLockingFailureException.class, () -> adapter.save(storyVersion));

    verify(repository, never()).save(persisted);
  }

  @Test
  void persistedStoryVersionCannotBeSilentlyRecreatedWhenMissing() {
    StoryVersion storyVersion =
        StoryVersion.rehydrate(
            11L,
            3L,
            7L,
            1,
            "content",
            "vi-VN",
            StoryVersionStatus.DRAFT,
            ModerationDecision.PENDING);
    when(repository.findById(11L)).thenReturn(Optional.empty());
    StoryVersionPersistenceAdapter adapter = new StoryVersionPersistenceAdapter(repository);

    assertThrows(ResourceNotFoundException.class, () -> adapter.save(storyVersion));
  }

  private static StoryVersionJpaEntity persistedStoryVersion(long rowVersion) {
    StoryVersionJpaEntity entity =
        StoryVersionJpaEntity.builder()
            .projectId(7L)
            .versionNumber(1)
            .content("server")
            .sourceLanguage("vi-VN")
            .status(StoryVersionStatus.DRAFT)
            .moderationDecision(ModerationDecision.PENDING)
            .build();
    entity.setId(11L);
    entity.setRowVersion(rowVersion);
    return entity;
  }
}
