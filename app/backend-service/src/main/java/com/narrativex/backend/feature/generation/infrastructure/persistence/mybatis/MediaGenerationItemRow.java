package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationExecutionStatus;
import com.narrativex.backend.feature.generation.domain.enums.MediaGenerationReviewStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MediaGenerationItemRow {
  private UUID id;
  private long rowVersion;
  private UUID generationJobId;
  private UUID mediaPlanId;
  private Long visualBeatId;
  private String itemKey;
  private int attemptNumber;
  private MediaGenerationExecutionStatus executionStatus;
  private UUID providerOperationId;
  private UUID mediaAssetId;
  private String requestFingerprint;
  private String errorCode;
  private String errorDetailRef;
  private MediaGenerationReviewStatus reviewStatus;
  private String reviewedByUserId;
  private Instant reviewedAt;
  private Instant createdAt;
  private Instant updatedAt;
}
