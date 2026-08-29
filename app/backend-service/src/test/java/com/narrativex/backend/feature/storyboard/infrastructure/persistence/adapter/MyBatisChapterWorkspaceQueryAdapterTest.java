package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceAggregateRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspacePreviewRow;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MyBatisChapterWorkspaceQueryAdapterTest {
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();

  @Test
  void stalledVisualGenerationCannotCollapseToCompletedFromLatestRow() {
    ChapterWorkspaceAggregateRow row = new ChapterWorkspaceAggregateRow();
    row.setVisualGenerationTotal(2);
    row.setVisualGenerationCompleted(1);
    row.setVisualGenerationStalled(1);

    ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
    when(mapper.aggregate(PROJECT_ID, CHAPTER_ID)).thenReturn(row);
    when(mapper.previewScenes(PROJECT_ID, CHAPTER_ID)).thenReturn(List.of());

    var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(PROJECT_ID, CHAPTER_ID);

    assertEquals("STALLED", snapshot.projection().visualGeneration().status());
  }

  @Test
  void unknownVisualGenerationCannotCollapseToCompletedFromLatestRow() {
    ChapterWorkspaceAggregateRow row = new ChapterWorkspaceAggregateRow();
    row.setVisualGenerationTotal(2);
    row.setVisualGenerationCompleted(1);
    row.setVisualGenerationUnknown(1);

    ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
    when(mapper.aggregate(PROJECT_ID, CHAPTER_ID)).thenReturn(row);
    when(mapper.previewScenes(PROJECT_ID, CHAPTER_ID)).thenReturn(List.of());

    var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(PROJECT_ID, CHAPTER_ID);

    assertEquals("UNKNOWN", snapshot.projection().visualGeneration().status());
  }

  @Test
  void narrationSnapshotKeepsTheVoiceUsedByTheLatestRequest() {
    ChapterWorkspaceAggregateRow row = new ChapterWorkspaceAggregateRow();
    row.setNarrationVoiceId("adam");

    ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
    when(mapper.aggregate(PROJECT_ID, CHAPTER_ID)).thenReturn(row);
    when(mapper.previewScenes(PROJECT_ID, CHAPTER_ID)).thenReturn(List.of());

    var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(PROJECT_ID, CHAPTER_ID);

    assertEquals("adam", snapshot.projection().audio().voiceId());
  }

  @Test
  void previewSceneKeepsCanonicalPreviewMediaAssetIdentity() {
    UUID previewMediaAssetId = UuidV7.random();
    ChapterWorkspaceAggregateRow aggregate = new ChapterWorkspaceAggregateRow();
    ChapterWorkspacePreviewRow preview = new ChapterWorkspacePreviewRow();
    preview.setId(UuidV7.random());
    preview.setTitle("Scene");
    preview.setStatus("DRAFT");
    preview.setPreviewMediaAssetId(previewMediaAssetId);

    ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
    when(mapper.aggregate(PROJECT_ID, CHAPTER_ID)).thenReturn(aggregate);
    when(mapper.previewScenes(PROJECT_ID, CHAPTER_ID)).thenReturn(List.of(preview));

    var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(PROJECT_ID, CHAPTER_ID);

    assertEquals(previewMediaAssetId, snapshot.previewScenes().getFirst().previewMediaAssetId());
  }
}
