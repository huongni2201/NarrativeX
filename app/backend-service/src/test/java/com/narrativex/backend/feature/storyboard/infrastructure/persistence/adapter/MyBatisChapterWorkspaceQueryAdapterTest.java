package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceAggregateRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterWorkspaceMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class MyBatisChapterWorkspaceQueryAdapterTest {

  @Test
  void stalledVisualGenerationCannotCollapseToCompletedFromLatestRow() {
    ChapterWorkspaceAggregateRow row = new ChapterWorkspaceAggregateRow();
    row.setVisualGenerationTotal(2);
    row.setVisualGenerationCompleted(1);
    row.setVisualGenerationStalled(1);

    ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
    when(mapper.aggregate(100L, 300L)).thenReturn(row);
    when(mapper.previewScenes(100L, 300L)).thenReturn(List.of());

    var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(100L, 300L);

    assertEquals("STALLED", snapshot.projection().visualGeneration().status());
  }

  @Test
  void unknownVisualGenerationCannotCollapseToCompletedFromLatestRow() {
    ChapterWorkspaceAggregateRow row = new ChapterWorkspaceAggregateRow();
    row.setVisualGenerationTotal(2);
    row.setVisualGenerationCompleted(1);
    row.setVisualGenerationUnknown(1);

    ChapterWorkspaceMapper mapper = mock(ChapterWorkspaceMapper.class);
    when(mapper.aggregate(100L, 300L)).thenReturn(row);
    when(mapper.previewScenes(100L, 300L)).thenReturn(List.of());

    var snapshot = new MyBatisChapterWorkspaceQueryAdapter(mapper).get(100L, 300L);

    assertEquals("UNKNOWN", snapshot.projection().visualGeneration().status());
  }
}
