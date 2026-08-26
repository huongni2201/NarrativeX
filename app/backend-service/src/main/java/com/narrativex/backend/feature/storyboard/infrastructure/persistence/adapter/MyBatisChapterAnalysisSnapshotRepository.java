package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotRow;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterAnalysisSnapshotRepository implements ChapterAnalysisSnapshotRepository {
  private final ChapterAnalysisSnapshotMapper mapper;

  @Override
  public ChapterAnalysisSource requireOwnedByProject(
      UUID projectId, UUID chapterId, String userId) {
    ChapterAnalysisSnapshotRow row = mapper.findOwned(projectId, chapterId, userId);
    if (row == null) {
      throw new ResourceNotFoundException("Chapter not found");
    }
    return new ChapterAnalysisSource(
        row.getId(),
        row.getStoryVersionId(),
        row.getRowVersion(),
        row.getSourceHash(),
        row.getSourceText());
  }
}
