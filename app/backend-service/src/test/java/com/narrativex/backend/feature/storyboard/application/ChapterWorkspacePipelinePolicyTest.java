package com.narrativex.backend.feature.storyboard.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.feature.storyboard.application.service.ChapterWorkspacePipelinePolicy;
import org.junit.jupiter.api.Test;

class ChapterWorkspacePipelinePolicyTest {
  @Test
  void completedCurrentAnalysisWithStoryboardCompletesPlanning() {
    var state = ChapterWorkspacePipelinePolicy.resolve("hash-v2", "COMPLETED", "hash-v2", true);

    assertEquals("COMPLETED", state.analysisStatus());
    assertEquals("COMPLETED", state.planningStatus());
    assertFalse(state.sourceOutdated());
    assertFalse(state.analysisActive());
  }

  @Test
  void completedStaleAnalysisNeverCompletesPlanning() {
    var state = ChapterWorkspacePipelinePolicy.resolve("hash-v2", "COMPLETED", "hash-v1", true);

    assertEquals("COMPLETED", state.analysisStatus());
    assertEquals("NOT_STARTED", state.planningStatus());
    assertTrue(state.sourceOutdated());
  }

  @Test
  void pausedCostLimitRemainsActiveAndBlocksAnotherAnalysis() {
    var state =
        ChapterWorkspacePipelinePolicy.resolve(
            "hash-v2", "PAUSED_COST_LIMIT", "hash-v2", false);

    assertTrue(state.analysisActive());
    assertEquals("NOT_STARTED", state.planningStatus());
  }

  @Test
  void missingAnalysisIsNotStartedAndNotActive() {
    var state = ChapterWorkspacePipelinePolicy.resolve("hash-v2", null, null, false);

    assertEquals("NOT_STARTED", state.analysisStatus());
    assertEquals("NOT_STARTED", state.planningStatus());
    assertFalse(state.sourceOutdated());
    assertFalse(state.analysisActive());
  }
}
