package com.narrativex.backend.feature.assets.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;

public class MediaAssetRow {
  private UUID id;
  private String accountId;
  private UUID projectId;
  private String assetType;
  private String origin;
  private String storageKey;
  private String storageMode;
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

  public MediaAssetRow() {}

  public MediaAssetRow(
      UUID id,
      String accountId,
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
    this.accountId = accountId;
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

  public UUID getId() {
    return id;
  }

  public String getAccountId() {
    return accountId;
  }

  public UUID getProjectId() {
    return projectId;
  }

  public String getAssetType() {
    return assetType;
  }

  public String getOrigin() {
    return origin;
  }

  public String getStorageKey() {
    return storageKey;
  }

  public String getStorageMode() {
    return storageMode;
  }

  public String getOriginalFilename() {
    return originalFilename;
  }

  public String getContentType() {
    return contentType;
  }

  public long getSizeBytes() {
    return sizeBytes;
  }

  public String getSha256() {
    return sha256;
  }

  public Long getDurationMs() {
    return durationMs;
  }

  public String getStatus() {
    return status;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public Instant getChecksumVerifiedAt() {
    return checksumVerifiedAt;
  }

  public String getDetectedContentType() {
    return detectedContentType;
  }

  public String getDetectedContainer() {
    return detectedContainer;
  }

  public String getDetectedCodec() {
    return detectedCodec;
  }

  public Integer getWidth() {
    return width;
  }

  public Integer getHeight() {
    return height;
  }

  public String getValidationErrorCode() {
    return validationErrorCode;
  }

  public String getValidationErrorDetail() {
    return validationErrorDetail;
  }

  public Instant getValidatedAt() {
    return validatedAt;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public void setAccountId(String accountId) {
    this.accountId = accountId;
  }

  public void setProjectId(UUID projectId) {
    this.projectId = projectId;
  }

  public void setAssetType(String assetType) {
    this.assetType = assetType;
  }

  public void setOrigin(String origin) {
    this.origin = origin;
  }

  public void setStorageKey(String storageKey) {
    this.storageKey = storageKey;
  }

  public void setStorageMode(String storageMode) {
    this.storageMode = storageMode;
  }

  public void setOriginalFilename(String originalFilename) {
    this.originalFilename = originalFilename;
  }

  public void setContentType(String contentType) {
    this.contentType = contentType;
  }

  public void setSizeBytes(long sizeBytes) {
    this.sizeBytes = sizeBytes;
  }

  public void setSha256(String sha256) {
    this.sha256 = sha256;
  }

  public void setDurationMs(Long durationMs) {
    this.durationMs = durationMs;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public void setCreatedAt(Instant createdAt) {
    this.createdAt = createdAt;
  }

  public void setDeletedAt(Instant deletedAt) {
    this.deletedAt = deletedAt;
  }

  public void setChecksumVerifiedAt(Instant checksumVerifiedAt) {
    this.checksumVerifiedAt = checksumVerifiedAt;
  }

  public void setDetectedContentType(String value) {
    this.detectedContentType = value;
  }

  public void setDetectedContainer(String value) {
    this.detectedContainer = value;
  }

  public void setDetectedCodec(String value) {
    this.detectedCodec = value;
  }

  public void setWidth(Integer value) {
    this.width = value;
  }

  public void setHeight(Integer value) {
    this.height = value;
  }

  public void setValidationErrorCode(String value) {
    this.validationErrorCode = value;
  }

  public void setValidationErrorDetail(String value) {
    this.validationErrorDetail = value;
  }

  public void setValidatedAt(Instant value) {
    this.validatedAt = value;
  }
}
