package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MediaAssetRow {
  private UUID id;
  private UUID projectId;
  private String assetType;
  private String origin;
  private String storageKey;
  private String originalFilename;
  private String contentType;
  private long sizeBytes;
  private String sha256;
  private Long durationMs;
  private String status;
  private Instant createdAt;
  private Instant deletedAt;
  private Instant checksumVerifiedAt;
  private String detectedContentType;
  private String detectedContainer;
  private String detectedCodec;
  private Integer width;
  private Integer height;
  private String validationErrorCode;
  private String validationErrorDetail;
  private Instant validatedAt;

  public MediaAssetRow(
      UUID id,
      UUID projectId,
      String assetType,
      String origin,
      String storageKey,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      Long durationMs,
      String status,
      Instant createdAt,
      Instant deletedAt,
      Instant checksumVerifiedAt) {
    this.id = id;
    this.projectId = projectId;
    this.assetType = assetType;
    this.origin = origin;
    this.storageKey = storageKey;
    this.originalFilename = originalFilename;
    this.contentType = contentType;
    this.sizeBytes = sizeBytes;
    this.sha256 = sha256;
    this.durationMs = durationMs;
    this.status = status;
    this.createdAt = createdAt;
    this.deletedAt = deletedAt;
    this.checksumVerifiedAt = checksumVerifiedAt;
  }
}
