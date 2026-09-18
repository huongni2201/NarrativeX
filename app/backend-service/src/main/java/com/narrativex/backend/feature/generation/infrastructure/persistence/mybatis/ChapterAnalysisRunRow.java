package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChapterAnalysisRunRow {
  private UUID id;
  private UUID generationJobId;
  private UUID chapterId;
  private UUID storyboardRevisionId;
  private String sourceHash;
  private String model;
  private String promptVersion;
  private String schemaVersion;
  private long promptTokens;
  private long outputTokens;
  private long thinkingTokens;
  private long cachedTokens;
  private long totalTokens;
  private long runtimeMs;
  private String canonHash;
  private Instant createdAt;
}
