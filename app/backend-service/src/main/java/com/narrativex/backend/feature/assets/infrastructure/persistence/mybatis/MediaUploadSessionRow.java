package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MediaUploadSessionRow {
  private UUID id;
  private String assetType;
  private String originalFilename;
  private String contentType;
  private long expectedSize;
  private String expectedSha256;
  private String storageKey;
  private String idempotencyKey;
  private String status;
  private Instant expiresAt;
  private Instant createdAt;
  private UUID mediaAssetId;
}
