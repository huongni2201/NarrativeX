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
public class ProductionTimelineBeatRow {
  private UUID chapterId;
  private int chapterOrderIndex;
  private UUID mediaPlanId;
  private Integer mediaPlanRevision;
  private int sceneIndex;
  private int beatIndex;
  private UUID visualBeatId;
  private String title;
  private String visualIntent;
  private String cameraMovement;
  private String assetStrategy;
  private Integer textStart;
  private Integer textEnd;
  private UUID mediaAssetId;
  private String mediaType;
  private Long sourceDurationMs;
  private String fitMode;
  private long trimStartMs;
  private boolean mediaSelectionActive;
  private String storageKey;
  private Long sizeBytes;
  private String checksum;
}
