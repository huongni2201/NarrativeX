package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectRenderArtifactRow {
  private Long id;
  private UUID projectId;
  private UUID generationJobId;
  private String storageKey;
  private String mimeType;
  private long sizeBytes;
  private String checksumSha256;
  private long durationMs;
  private int width;
  private int height;
  private int fps;
  private String status;
}
