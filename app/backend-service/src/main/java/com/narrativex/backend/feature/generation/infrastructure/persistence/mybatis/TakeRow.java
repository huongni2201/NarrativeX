package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TakeRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID shotId;
  private int attemptNumber;
  private String provider;
  private String model;
  private String generationMode;
  private UUID outputAssetId;
  private Long sourceDurationMs;
  private String metricsJson;
  private String validationStatus;
  private String validationFailureCategory;
  private String validationFailureReason;
  private String validationRetryRecommendation;
  private String status;
}
