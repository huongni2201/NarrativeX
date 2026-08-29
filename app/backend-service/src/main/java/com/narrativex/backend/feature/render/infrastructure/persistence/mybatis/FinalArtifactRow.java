package com.narrativex.backend.feature.render.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FinalArtifactRow {
  private Long id;
  private UUID projectId;
  private UUID chapterId;
  private String artifactType;
  private String renderFingerprint;
  private String storageKey;
  private String mimeType;
  private Long sizeBytes;
  private String checksumSha256;
  private Long durationMs;
  private Integer width;
  private Integer height;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;
}
