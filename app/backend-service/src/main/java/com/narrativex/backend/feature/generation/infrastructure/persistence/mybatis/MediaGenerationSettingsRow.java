package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.Data;

@Data
public class MediaGenerationSettingsRow {
  private String aspectRatio;
  private String imageStyle;
  private String providerKey;
  private String modelKey;
  private String pricingSnapshotJson;
  private String pricingFingerprint;
}
