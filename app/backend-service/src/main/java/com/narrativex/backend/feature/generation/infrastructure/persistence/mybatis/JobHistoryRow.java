package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class JobHistoryRow {
  private UUID id;
  private UUID jobId;
  private UUID projectId;
  private String projectName;
  private String jobType;
  private String status;
  private int progress;
  private String currentStep;
  private String errorCode;
  private Instant createdAt;
  private Instant completedAt;
}
