package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RetentionMapRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID chapterId;
  private String tensionCurveJson;
  private String openQuestionsJson;
  private String resolvedQuestionsJson;
  private String pacingWarningsJson;
}
