package com.narrativex.backend.feature.generation.api.request;

import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;

/** Selects how chapter analysis should direct visual beats. */
public record AnalyzeChapterRequest(ProductionMode productionMode) {
  public ProductionMode effectiveProductionMode() {
    return productionMode == null ? ProductionMode.IMAGE_MOTION : productionMode;
  }
}
