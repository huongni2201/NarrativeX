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
  private String selfReportedTier;
  private boolean desiredEnabled;
  private int desiredMaxConcurrent;
  private Instant drainRequestedAt;
  private Instant retiredAt;
  private String observedConnectionState;
  private String cliVersion;
  private String modelCapabilitiesJson;
  private String observedQuotaState;
  private Instant quotaObservedAt;
  private Instant nextEligibleAt;
  private UUID runtimeEpoch;
  private long observationSequence;
  private long lastAssignedOrdinal;
  private long rowVersion;
}
