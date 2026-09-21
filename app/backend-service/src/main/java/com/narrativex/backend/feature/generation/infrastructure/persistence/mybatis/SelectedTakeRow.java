package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SelectedTakeRow {
  private UUID shotId;
  private UUID takeId;
  private long sourceInMs;
  private long sourceOutMs;
  private Instant createdAt;
  private Instant updatedAt;
}
