package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardRevisionMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardRevisionRow;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisStoryboardRevisionAccess implements StoryboardRevisionAccess {
  private final StoryboardRevisionMapper mapper;

  @Override
  public void lockChapter(Long chapterId) {
    mapper.lockChapter(chapterId);
  }

  @Override
  public Snapshot current(Long chapterId) {
    StoryboardRevisionRow row = mapper.current(chapterId);
    return row == null ? Snapshot.empty() : new Snapshot(row.getId(), row.getSourceHash(), row.isHasApprovedOutput());
  }

  @Override
  public Long createDraft(Long chapterId, String sourceHash, long sourceRowVersion) {
    Objects.requireNonNull(sourceHash, "sourceHash");
    Long revisionId = mapper.createDraft(chapterId, sourceHash, sourceRowVersion);
    if (revisionId == null) {
      throw new IllegalStateException("Failed to create storyboard revision for chapter " + chapterId);
    }
    return revisionId;
  }
}
