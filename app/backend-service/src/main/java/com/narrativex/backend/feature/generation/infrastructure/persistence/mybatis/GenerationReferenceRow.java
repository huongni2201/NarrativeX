package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GenerationReferenceRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private UUID shotId;
  private String referenceType;
  private UUID mediaAssetId;
  private BigDecimal weight;
}
