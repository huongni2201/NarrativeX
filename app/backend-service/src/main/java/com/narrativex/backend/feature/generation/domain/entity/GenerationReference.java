package com.narrativex.backend.feature.generation.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.generation.domain.enums.ReferenceType;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

/** Reference asset conditioning a video generation attempt for a Shot. */
public final class GenerationReference extends DomainEntity {
  private final UUID shotId;
  private final ReferenceType referenceType;
  private final UUID mediaAssetId;
  private final BigDecimal weight;

  public GenerationReference(
      UUID shotId, ReferenceType referenceType, UUID mediaAssetId, BigDecimal weight) {
    this(null, 0L, shotId, referenceType, mediaAssetId, weight);
  }

  public GenerationReference(
      UUID id,
      long rowVersion,
      UUID shotId,
      ReferenceType referenceType,
      UUID mediaAssetId,
      BigDecimal weight) {
    super(id, rowVersion);
    this.shotId = Objects.requireNonNull(shotId, "shotId must not be null");
    this.referenceType = Objects.requireNonNull(referenceType, "referenceType must not be null");
    this.mediaAssetId = Objects.requireNonNull(mediaAssetId, "mediaAssetId must not be null");
    this.weight = weight != null ? weight : BigDecimal.ONE;
  }

  public UUID getShotId() {
    return shotId;
  }

  public ReferenceType getReferenceType() {
    return referenceType;
  }

  public UUID getMediaAssetId() {
    return mediaAssetId;
  }

  public BigDecimal getWeight() {
    return weight;
  }
}
