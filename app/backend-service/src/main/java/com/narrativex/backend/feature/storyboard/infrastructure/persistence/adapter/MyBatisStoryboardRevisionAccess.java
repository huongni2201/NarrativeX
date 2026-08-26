package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardRevisionMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardRevisionRow;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisStoryboardRevisionAccess implements StoryboardRevisionAccess {
  private final StoryboardRevisionMapper mapper;

  @Override
  public void lockChapter(UUID chapterId) {
    mapper.lockChapter(chapterId);
  }

  @Override
  public Snapshot current(UUID chapterId) {
    StoryboardRevisionRow row = mapper.current(chapterId);
    return row == null
        ? Snapshot.empty()
        : new Snapshot(row.getId(), row.getSourceHash(), row.isHasApprovedOutput());
  }

  @Override
  public UUID createDraft(UUID chapterId, String sourceHash, long sourceRowVersion) {
    Objects.requireNonNull(sourceHash, "sourceHash");
    UUID revisionId = mapper.createDraft(chapterId, sourceHash, sourceRowVersion);
    if (revisionId == null) {
      throw new IllegalStateException(
          "Failed to create storyboard revision for chapter " + chapterId);
    }
    return revisionId;
  }
}
