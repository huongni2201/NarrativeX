package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VisualPromptReferenceRow {
  private UUID visualBeatId;
  private UUID assignmentId;
  private UUID assetId;
  private String role;
  private int priority;
  private String storageKey;
  private String contentType;
  private String sha256;
}
