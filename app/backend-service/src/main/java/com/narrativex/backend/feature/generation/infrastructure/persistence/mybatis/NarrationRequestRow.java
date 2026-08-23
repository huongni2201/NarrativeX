package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.math.BigDecimal;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NarrationRequestRow {
  private UUID id;
  private UUID projectId;
  private UUID chapterId;
  private long chapterRowVersion;
  private String sourceHash;
  private String sourceText;
  private String voiceId;
  private String language;
  private BigDecimal speakingRate;
  private String segmentationVersion;
  private String requestFingerprint;
  private UUID voiceReferenceAssetId;

  public UUID id() {
    return id;
  }

  public UUID projectId() {
    return projectId;
  }

  public UUID chapterId() {
    return chapterId;
  }

  public long chapterRowVersion() {
    return chapterRowVersion;
  }

  public String sourceHash() {
    return sourceHash;
  }

  public String sourceText() {
    return sourceText;
  }

  public String voiceId() {
    return voiceId;
  }

  public String language() {
    return language;
  }

  public BigDecimal speakingRate() {
    return speakingRate;
  }

  public String segmentationVersion() {
    return segmentationVersion;
  }

  public String requestFingerprint() {
    return requestFingerprint;
  }

  public UUID voiceReferenceAssetId() {
    return voiceReferenceAssetId;
  }
}
