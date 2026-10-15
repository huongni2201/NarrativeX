package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnalysisProviderCredentialRow {
  private UUID credentialRef;
  private UUID deviceId;
  private String connectionFingerprint;
  private int credentialGeneration;
  private String label;
  private String observedConnectionState;
  private String adapterVersion;
  private String modelCapabilitiesJson;
  private String observedQuotaState;
  private Instant quotaObservedAt;
  private Instant nextEligibleAt;
  private UUID runtimeEpoch;
  private long observationSequence;
  private long rowVersion;
}
