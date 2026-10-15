package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ChapterProductionStatusRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterProductionStatusMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterProductionStatusRow;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisChapterProductionStatusAdapter implements ChapterProductionStatusRepository {
  private final ChapterProductionStatusMapper mapper;

  @Override
  public ShotAggregate aggregate(UUID projectId, UUID chapterId) {
    ChapterProductionStatusRow row = mapper.aggregate(projectId, chapterId);
    if (row == null) {
      return new ShotAggregate(0, 0, 0, 0, 0, 0, 0, 0, "");
    }
    return new ShotAggregate(
        row.getTotalShots(),
        row.getQueuedShots(),
        row.getGeneratingShots(),
        row.getValidatingShots(),
        row.getPassedShots(),
        row.getFailedShots(),
        row.getManualReviewShots(),
        row.getSelectedShots(),
        row.getChangeMarker() == null ? "" : row.getChangeMarker());
  }

  @Override
  public List<ShotStrategyGroup> shotStrategyGroups(UUID projectId, UUID chapterId) {
    return mapper.shotStrategyGroups(projectId, chapterId).stream()
        .map(row -> new ShotStrategyGroup(row.getVisualBeatId(), row.getStrategy(), row.getShots()))
        .toList();
  }
}
