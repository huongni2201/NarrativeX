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
  private Long audioStartMs;
  private Long audioEndMs;
  private Long audioDurationMs;
  private UUID mediaAssetId;
  private String storageKey;
  private Long sizeBytes;
  private String checksum;
}
