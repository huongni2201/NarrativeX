package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Data;

@Data
public class ContinuityBeatLineageRow {
  private UUID visualBeatId;
  private UUID sceneId;
  private Integer sceneOrderIndex;
  private Integer beatOrderIndex;
  private String semanticHash;
}
