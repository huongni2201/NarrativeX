package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterCreationIdempotencyRow {
  private Long id;
  private String ownerId;
  private Long projectId;
  private String idempotencyKey;
  private String requestFingerprint;
  private Long chapterId;
}
