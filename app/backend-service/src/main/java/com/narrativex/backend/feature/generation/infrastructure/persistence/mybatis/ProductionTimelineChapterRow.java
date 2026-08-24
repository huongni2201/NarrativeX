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
public class ProductionTimelineChapterRow {
  private UUID storyVersionId;
  private UUID chapterId;
  private int orderIndex;
  private String title;
  private long rowVersion;
  private String sourceHash;
  private UUID mediaPlanId;
  private Integer mediaPlanRevision;
  private String aspectRatio;
  private Long audioDurationMs;
  private String audioStorageKey;
  private Long audioSizeBytes;
  private String audioChecksum;
  private UUID narrationRequestId;
  private UUID narrationAssetId;
  private UUID narrationAlignmentId;
  private Long fallbackDurationMs;
  private int beatCount;
  private int readyBeatCount;
}
