package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterAnalysisPromptSnapshotRow {
  private UUID generationJobId;
  private long settingsRevision;
  private String instruction;
  private String instructionHash;
}
