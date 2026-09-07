package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Data;

@Data
public class StoryboardGenerationBeatSnapshotRow {
  private UUID id;
  private UUID batchId;
  private UUID visualBeatId;
  private UUID sceneId;
  private long beatRowVersion;
  private String prompt;
  private String negativePrompt;
  private String characterSnapshotJson;
  private String referencesJson;
  private String continuitySemanticHash;
  private String inputFingerprint;
}
