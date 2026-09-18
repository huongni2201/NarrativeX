package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AudioCueRow {
  private UUID id;
  private long rowVersion;
  private UUID storyBeatId;
  private int orderIndex;
  private String cueType;
  private UUID speakerProjectCharacterId;
  private Integer sourceStart;
  private Integer sourceEnd;
  private String sourceAnchorJson;
  private String adaptationAction;
  private String adaptedText;
  private String deliveryHint;
  private Integer narrationTextStart;
  private Integer narrationTextEnd;
  private Long audioStartMs;
  private Long audioEndMs;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
}
