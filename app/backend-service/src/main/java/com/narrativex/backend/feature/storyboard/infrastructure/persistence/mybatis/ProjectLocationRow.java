package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectLocationRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID projectId;
  private String name;
  private String description;
  private String visualPrompt;
  private String referenceImageUrl;
  private String status;
}
