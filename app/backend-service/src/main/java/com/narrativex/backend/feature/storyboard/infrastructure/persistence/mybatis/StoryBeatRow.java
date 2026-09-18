package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StoryBeatRow {
  private UUID id;
  private long rowVersion;
  private UUID sceneId;
  private int orderIndex;
  private Integer sourceStart;
  private Integer sourceEnd;
  private String sourceAnchorJson;
  private String purpose;
  private String summary;
  private String importance;
  private String storyFunctionsJson;
  private String continuityStateJson;
  private Instant createdAt;
  private Instant updatedAt;
}
