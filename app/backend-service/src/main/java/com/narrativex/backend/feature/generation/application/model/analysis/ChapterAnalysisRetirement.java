package com.narrativex.backend.feature.generation.application.model.analysis;

/**
 * Terminal outcome for chapter-analysis jobs that have no frozen Desktop execution snapshot. No
 * Desktop account can claim them and no compute worker owns them.
 */
public final class ChapterAnalysisRetirement {
  public static final String ERROR_CODE = "ANALYSIS_EXECUTION_RETIRED";
  public static final String STEP =
      "Server-side chapter analysis was retired; analyze the chapter again from the Desktop app";

  private ChapterAnalysisRetirement() {}
}
