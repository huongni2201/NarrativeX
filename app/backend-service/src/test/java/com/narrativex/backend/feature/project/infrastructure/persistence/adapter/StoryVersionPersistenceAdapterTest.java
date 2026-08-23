package com.narrativex.backend.feature.project.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.ModerationDecision;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.StoryVersionMapper;
import com.narrativex.backend.feature.project.infrastructure.persistence.mybatis.StoryVersionRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class StoryVersionPersistenceAdapterTest {
  private static final UUID STORY_ID = UuidV7.random();
  private static final UUID PROJECT_ID = UuidV7.random();

  @Mock private StoryVersionMapper mapper;

  @Test
  void rejectsDetachedStoryVersionWhenPersistedVersionMovedForward() {
    StoryVersion value =
        StoryVersion.rehydrate(
            STORY_ID,
            3L,
            PROJECT_ID,
            1,
            "content",
            "vi-VN",
            StoryVersionStatus.DRAFT,
            ModerationDecision.PENDING);
    when(mapper.findById(STORY_ID)).thenReturn(row(4L));
    MyBatisStoryVersionPersistenceAdapter adapter =
        new MyBatisStoryVersionPersistenceAdapter(mapper);
    assertThrows(OptimisticLockingFailureException.class, () -> adapter.save(value));
    verify(mapper, never()).update(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void persistedStoryVersionCannotBeSilentlyRecreatedWhenMissing() {
    StoryVersion value =
        StoryVersion.rehydrate(
            STORY_ID,
            3L,
            PROJECT_ID,
            1,
            "content",
            "vi-VN",
            StoryVersionStatus.DRAFT,
            ModerationDecision.PENDING);
    when(mapper.findById(STORY_ID)).thenReturn(null);
    assertThrows(
        ResourceNotFoundException.class,
        () -> new MyBatisStoryVersionPersistenceAdapter(mapper).save(value));
  }

  private static StoryVersionRow row(long version) {
    StoryVersionRow row = new StoryVersionRow();
    row.setId(STORY_ID);
    row.setRowVersion(version);
    row.setProjectId(PROJECT_ID);
    row.setVersionNumber(1);
    row.setContent("server");
    row.setSourceLanguage("vi-VN");
    row.setStatus("DRAFT");
    row.setModerationDecision("PENDING");
    return row;
  }
}
