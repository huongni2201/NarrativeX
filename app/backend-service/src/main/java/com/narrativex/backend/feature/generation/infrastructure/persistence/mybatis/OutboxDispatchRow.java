package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OutboxDispatchRow {
  private long id;
  private String eventType;
  private String payloadJson;
}
