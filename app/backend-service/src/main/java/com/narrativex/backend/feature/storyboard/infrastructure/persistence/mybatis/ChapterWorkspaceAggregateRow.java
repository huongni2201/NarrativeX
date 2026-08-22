package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterWorkspaceAggregateRow {
  private String projectName;
  private String moderationDecision;
  private int sceneCount;
  private int visualBeatCount;
  private long estimatedDurationSeconds;
  private String storyboardSourceHash;
  private boolean hasApprovedOutput;
  private String analysisStatus;
  private String analysisSourceHash;
  private Instant analysisCompletedAt;
  private int visualGenerationTotal;
  private int visualGenerationCompleted;
  private int visualGenerationFailed;
  private int visualGenerationRunning;
  private int visualGenerationQueued;
  private int visualGenerationActive;
  private String latestVisualGenerationStatus;
  private boolean narrationAssetReady;
  private String narrationJobStatus;
  private Instant narrationCompletedAt;
  private boolean renderManifestCreated;
  private String renderArtifactStatus;
  private String renderJobStatus;
  private Instant renderCompletedAt;
}
