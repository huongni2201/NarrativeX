package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterAnalysisSnapshotRow {
  private UUID id;
  private UUID storyVersionId;
  private long rowVersion;
  private String sourceHash;
  private String sourceText;
}
