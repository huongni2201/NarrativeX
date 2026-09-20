package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ShotRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID sequenceId;
  private int orderIndex;
  private String narrativePurpose;
  private String retentionRole;
  private String subjectsJson;
  private String locationRef;
  private String startStateJson;
  private String actionJson;
  private String endStateJson;
  private String compositionJson;
  private String cameraJson;
  private String subjectMotionJson;
  private String cameraMotionJson;
  private String environmentMotionJson;
  private long targetDurationMs;
  private String generationStrategy;
  private String qualityProfile;
  private UUID continuityFromShotId;
  private UUID continuityToShotId;
  private String status;
}
