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
  public MediaGenerationItemRow(UUID id, long rowVersion, UUID generationJobId, UUID mediaPlanId,
      UUID visualBeatId, String itemKey, int attemptNumber, MediaGenerationExecutionStatus executionStatus,
      UUID providerOperationId, UUID mediaAssetId, String requestFingerprint, String errorCode,
      String errorDetailRef, MediaGenerationReviewStatus reviewStatus, Instant reviewedAt,
      Instant createdAt, Instant updatedAt) {
    this(id,rowVersion,generationJobId,mediaPlanId,visualBeatId,itemKey,attemptNumber,executionStatus,
        providerOperationId,mediaAssetId,requestFingerprint,errorCode,errorDetailRef,reviewStatus,
        reviewedAt,createdAt,updatedAt,null,0,null,null,null,null);
  }
  private UUID id;
  private long rowVersion;
  private UUID generationJobId;
  private UUID mediaPlanId;
  private UUID visualBeatId;
  private String itemKey;
  private int attemptNumber;
  private MediaGenerationExecutionStatus executionStatus;
  private UUID providerOperationId;
  private UUID mediaAssetId;
  private String requestFingerprint;
  private String errorCode;
  private String errorDetailRef;
  private MediaGenerationReviewStatus reviewStatus;
  private Instant reviewedAt;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID shotId;
  private int orderIndex;
  private UUID leafGenerationJobId;
  private UUID takeId;
  private String frozenInputJson;
  private String frozenInputFingerprint;
}
