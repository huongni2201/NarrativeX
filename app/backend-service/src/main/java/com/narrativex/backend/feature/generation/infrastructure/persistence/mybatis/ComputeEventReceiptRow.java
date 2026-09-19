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
public class ComputeEventReceiptRow {
  private String eventId;
  private UUID taskId;
  private UUID attemptId;
  private long sequence;
  private String eventType;
  private Instant receivedAt;
  private String payloadHash;
}
