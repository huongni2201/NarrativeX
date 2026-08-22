package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterAnalysisSnapshotRow {
  private Long id;
  private Long storyVersionId;
  private long rowVersion;
  private String sourceHash;
  private String sourceText;
}
