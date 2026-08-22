package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterAnalysisSnapshotRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.ChapterAnalysisSnapshotRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterAnalysisSnapshotRepository
    implements ChapterAnalysisSnapshotRepository {
  private final ChapterAnalysisSnapshotMapper mapper;

  @Override
  public ChapterAnalysisSource requireOwnedByProject(Long projectId, Long chapterId, String userId) {
    return requireOwnedByProject(projectId, chapterId, userId, null);
  }

  @Override
  public ChapterAnalysisSource requireOwnedByProject(
      Long projectId, Long chapterId, String userId, Long contentVariantId) {
    ChapterAnalysisSnapshotRow row = mapper.findOwned(projectId, chapterId, userId, contentVariantId);
    if (row == null) {
      throw new ResourceNotFoundException("Chapter not found");
    }
    if (row.isStale()) {
      throw new ResourceConflictException(
          "Selected content variant is stale; refresh Chapter language state");
    }
    return new ChapterAnalysisSource(
        row.getId(), row.getStoryVersionId(), row.getRowVersion(), row.getSourceHash(), row.getSourceText(),
        row.getContentVariantId(), row.getLanguage(), row.getOriginVariantId());
  }
}
