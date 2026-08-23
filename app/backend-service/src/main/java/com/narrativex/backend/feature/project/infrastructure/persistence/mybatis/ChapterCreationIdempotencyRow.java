package com.narrativex.backend.feature.project.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterCreationIdempotencyRow {
  private Long id;
  private String ownerId;
  private UUID projectId;
  private String idempotencyKey;
  private String requestFingerprint;
  private UUID chapterId;
}
