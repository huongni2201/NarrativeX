package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChapterWorkspacePreviewRow {
  private Long id;
  private int orderIndex;
  private String title;
  private Integer durationSeconds;
  private String status;
  private int visualBeatCount;
  private String previewImageUrl;
}
