package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterWorkspaceAggregateRow {
  private String projectName;
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
  private int visualGenerationStalled;
  private int visualGenerationUnknown;
  private int visualGenerationPaused;
  private String visualGenerationLatestJobId;
  private UUID visualGenerationMediaPlanId;
  private Integer visualGenerationMediaPlanRevision;
  private boolean narrationAssetReady;
  private String narrationJobStatus;
  private Instant narrationCompletedAt;
  private String narrationStorageKey;
  private Long narrationDurationMs;
  private boolean renderManifestCreated;
  private String renderArtifactStatus;
  private String renderJobStatus;
  private String renderJobId;
  private Long renderArtifactId;
  private Instant renderCompletedAt;
}
