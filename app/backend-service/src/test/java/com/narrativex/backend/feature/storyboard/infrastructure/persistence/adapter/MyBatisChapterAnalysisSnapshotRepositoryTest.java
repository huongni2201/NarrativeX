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
  void rejectsMissingOwnedChapterAsNotFound() {
    when(mapper.findOwned(PROJECT_ID, CHAPTER_ID, "user-1")).thenReturn(null);

    assertThrows(
        ResourceNotFoundException.class,
        () -> repository.requireOwnedByProject(PROJECT_ID, CHAPTER_ID, "user-1"));
  }

  @Test
  void mapsOwnedChapterToCurrentAnalysisSource() {
    var row = new ChapterAnalysisSnapshotRow();
    UUID variantId = UuidV7.random();
    UUID storyVersionId = UuidV7.random();
    row.setId(variantId);
    row.setStoryVersionId(storyVersionId);
    row.setRowVersion(7L);
    row.setSourceHash("a".repeat(64));
    row.setSourceText("Chapter source");
    when(mapper.findOwned(PROJECT_ID, CHAPTER_ID, "user-1")).thenReturn(row);

    var source = repository.requireOwnedByProject(PROJECT_ID, CHAPTER_ID, "user-1");

    assertEquals(variantId, source.contentVariantId());
    assertEquals(storyVersionId, source.storyVersionId());
    assertEquals(7L, source.rowVersion());
    assertEquals("a".repeat(64), source.sourceHash());
    assertEquals("Chapter source", source.sourceText());
  }
}
