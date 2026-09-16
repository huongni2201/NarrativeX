package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
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

  @Mock private ChapterAnalysisSnapshotMapper mapper;
  @InjectMocks private MyBatisChapterAnalysisSnapshotRepository repository;

  @Test
  void rejectsMissingChapterAsNotFound() {
    when(mapper.findByProject(PROJECT_ID, CHAPTER_ID)).thenReturn(null);

    assertThrows(
        ResourceNotFoundException.class, () -> repository.requireByProject(PROJECT_ID, CHAPTER_ID));
  }

  @Test
  void mapsChapterToCurrentAnalysisSource() {
    var row = new ChapterAnalysisSnapshotRow();
    UUID snapshotId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    row.setId(snapshotId);
    row.setStoryVersionId(storyVersionId);
    row.setRowVersion(7L);
    row.setSourceHash("a".repeat(64));
    row.setSourceText("Chapter source");
    when(mapper.findByProject(PROJECT_ID, CHAPTER_ID)).thenReturn(row);

    var source = repository.requireByProject(PROJECT_ID, CHAPTER_ID);

    assertEquals(snapshotId, source.chapterId());
    assertEquals(storyVersionId, source.storyVersionId());
    assertEquals(7L, source.rowVersion());
    assertEquals("a".repeat(64), source.sourceHash());
    assertEquals("Chapter source", source.sourceText());
  }
}
