package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterAnalysisExecutionSnapshotRow {
  private UUID generationJobId;
  private String executionMode;
  private String profileJson;
  private String promptVersion;
  private String promptHash;
  private String promptTemplate;
  private String schemaVersion;
  private String schemaHash;
  private String responseSchemaJson;
  private String inputFingerprint;
  private long configRevision;
  private Instant createdAt;
}
