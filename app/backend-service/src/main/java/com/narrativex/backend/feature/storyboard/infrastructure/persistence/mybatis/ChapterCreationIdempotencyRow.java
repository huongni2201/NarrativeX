package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChapterCreationIdempotencyRow {
  private UUID id;
  private String ownerId;
  private UUID projectId;
  private String idempotencyKey;
  private String requestFingerprint;
  private UUID chapterId;
  private Instant createdAt;
  private Instant completedAt;
}
