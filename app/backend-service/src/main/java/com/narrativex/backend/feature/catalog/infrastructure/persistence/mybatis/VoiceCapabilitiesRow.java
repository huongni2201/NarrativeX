package com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VoiceCapabilitiesRow {
  private String id;
  private String provider;
  private boolean supportsSpeakingRate;
  private boolean supportsVoiceClone;
  private boolean supportsBatch;
  private int sampleRateHz;
  private String executionSemantics;
}
