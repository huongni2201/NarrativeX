package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MediaPlanRow {
  private UUID id;
  private Long chapterId;
  private long chapterRowVersion;
  private String sourceHash;
  private ProductionMode productionMode;
  private int revision;
  private long narrationCharacters;
  private int imageGenerateCount;
  private int imageEditCount;
  private int basicMotionSeconds;
  private int plannedI2vSeconds;
  private BigDecimal estimatedCost;
  private Instant createdAt;
}
