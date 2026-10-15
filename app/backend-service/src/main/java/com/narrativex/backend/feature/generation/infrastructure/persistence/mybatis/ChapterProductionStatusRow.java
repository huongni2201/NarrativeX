package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChapterProductionStatusRow {
  private int totalShots;
  private int queuedShots;
  private int generatingShots;
  private int validatingShots;
  private int passedShots;
  private int failedShots;
  private int manualReviewShots;
  private int selectedShots;
  private String changeMarker;
}
