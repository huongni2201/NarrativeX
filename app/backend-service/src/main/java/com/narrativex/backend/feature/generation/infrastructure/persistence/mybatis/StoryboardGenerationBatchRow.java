package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Data;

@Data
public class StoryboardGenerationBatchRow {
  private UUID id;
  private UUID projectId;
  private UUID chapterId;
  private UUID storyboardRevisionId;
  private String sourceHash;
  private UUID continuityPlanId;
  private Integer continuityPlanRevision;
  private Integer continuityReportRevision;
  private String stylePolicyVersion;
  private String providerPolicyVersion;
  private String idempotencyKey;
  private String requestFingerprint;
  private String issuesJson;
  private String status;
  private Instant createdAt;
}
