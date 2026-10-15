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
  private Long promptTokens;
  private Long outputTokens;
  private Long thinkingTokens;
  private Long cachedTokens;
  private Long totalTokens;
  private Long runtimeMs;
  private String canonHash;
  private Instant createdAt;
  private String usageState;
  private String executionMode;
  private UUID attemptId;
  private UUID credentialRef;
  private String adapterVersion;
  private String conversationId;
  private String modelObserved;
  private String effortObserved;
  private String promptHash;
  private String schemaHash;
  private String outputHash;
}
