package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Data;

@Data
public class RegenerationPlanRow {
  private UUID id;
  private UUID projectId;
  private UUID chapterId;
  private UUID continuityPlanId;
  private String sourceHash;
  private String requestedBeatIdsJson;
  private String affectedBeatIdsJson;
  private String reusableBeatIdsJson;
  private String reason;
  private Instant expiresAt;
  private String inputFingerprint;
  private String createdBy;
}
