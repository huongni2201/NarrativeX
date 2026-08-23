package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.storyboard.domain.exception.ContentVariantNotReadyException;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class MyBatisChapterAnalysisSnapshotRepositoryTest {
  @Mock private ChapterAnalysisSnapshotMapper mapper;
  @InjectMocks private MyBatisChapterAnalysisSnapshotRepository repository;

  @Test
  void rejectsAnOwnedButStaleExplicitVariantAsConflict() {
    var row = new ChapterAnalysisSnapshotRow();
    row.setStale(true);
    when(mapper.findOwned(7L, 11L, "user-1", 99L)).thenReturn(row);

    assertThrows(
        ResourceConflictException.class,
        () -> repository.requireOwnedByProject(7L, 11L, "user-1", 99L));
  }

  @Test
  void rejectsMissingOwnedOriginalVariantAsContentVariantConflict() {
    when(mapper.existsOwnedChapter(7L, 11L, "user-1")).thenReturn(true);

    assertThrows(
        ContentVariantNotReadyException.class,
        () -> repository.requireOwnedByProject(7L, 11L, "user-1"));
  }
}
