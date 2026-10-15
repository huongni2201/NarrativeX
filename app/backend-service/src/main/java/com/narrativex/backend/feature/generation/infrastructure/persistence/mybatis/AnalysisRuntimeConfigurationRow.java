package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnalysisRuntimeConfigurationRow {
  private long revision;
  private String executionMode;
  private String model;
  private String effort;
  private int maxConcurrentAnalyses;
  private int defaultMaxConcurrentPerCredential;
  private int maxQueuedAnalyses;
  private long maxInputBytes;
  private long maxOutputBytes;
  private long maxRuntimeMs;
  private long rowVersion;
}
