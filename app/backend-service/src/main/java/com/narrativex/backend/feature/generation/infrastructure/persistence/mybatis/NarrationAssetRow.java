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
public class NarrationAssetRow {
  private UUID id;
  private UUID narrationRequestId;
  private UUID projectAssetId;
  private long durationMs;
  private String sourceHash;
}
