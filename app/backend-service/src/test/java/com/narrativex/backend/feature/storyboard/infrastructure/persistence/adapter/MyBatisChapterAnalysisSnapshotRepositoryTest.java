package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.domain.exception.ContentVariantNotReadyException;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotRow;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MyBatisChapterAnalysisSnapshotRepositoryTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();
  private static final UUID VARIANT_ID = UuidV7.random();

  @Mock private ChapterAnalysisSnapshotMapper mapper;
  @InjectMocks private MyBatisChapterAnalysisSnapshotRepository repository;

  @Test
  void rejectsAnOwnedButStaleExplicitVariantAsConflict() {
    var row = new ChapterAnalysisSnapshotRow();
    row.setStale(true);
    when(mapper.findOwned(PROJECT_ID, CHAPTER_ID, "user-1", VARIANT_ID)).thenReturn(row);

    assertThrows(
        ResourceConflictException.class,
        () -> repository.requireOwnedByProject(PROJECT_ID, CHAPTER_ID, "user-1", VARIANT_ID));
  }

  @Test
  void rejectsMissingOwnedOriginalVariantAsContentVariantConflict() {
    when(mapper.existsOwnedChapter(PROJECT_ID, CHAPTER_ID, "user-1")).thenReturn(true);

    assertThrows(
        ContentVariantNotReadyException.class,
        () -> repository.requireOwnedByProject(PROJECT_ID, CHAPTER_ID, "user-1"));
  }
}
