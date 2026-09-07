package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Data;

@Data
public class VisualPromptContinuityRow {
  private UUID visualBeatId;
  private UUID planId;
  private String timelineKey;
  private String entryFactsJson;
  private String visibleFactsJson;
  private String exitFactsJson;
  private String eventKeysJson;
  private String semanticHash;
}
