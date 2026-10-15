package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OutboxDispatchRow {
  private long id;
  private String aggregateId;
  private Instant createdAt;
  private String lane;
}
