package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class StoryVersionRow {
  private Long id; private long rowVersion; private Instant createdAt; private Instant updatedAt;
  private Long projectId; private int versionNumber; private String content; private String sourceLanguage; private String status; private String moderationDecision;
}
