package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
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
public class StageAttemptRow {
  private UUID id;
  private long rowVersion;
  private UUID generationJobId;
  private String stageName;
  private int attemptNumber;
  private JobStatus status;
  private String workerId;
  private Instant heartbeatAt;
}
