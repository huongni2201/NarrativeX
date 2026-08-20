package com.narrativex.backend.feature.account.application.port.in;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

class PlanFeaturesTest {
  private final JsonMapper jsonMapper = JsonMapper.builder().build();

  @Test
  void readsTopLevelStoryAnalysisAndIgnoresUnknownFlags() throws JacksonException {
    PlanFeatures features =
        jsonMapper.readValue(
            """
            {
              "storyAnalysis": true,
              "shorts": true,
              "futureFeature": true
            }
            """,
            PlanFeatures.class);

    assertTrue(features.storyAnalysisEnabled());
  }

  @Test
  void missingStoryAnalysisDefaultsToFalse() throws JacksonException {
    PlanFeatures features = jsonMapper.readValue("{}", PlanFeatures.class);

    assertFalse(features.storyAnalysisEnabled());
  }

  @Test
  void explicitNullStoryAnalysisDefaultsToFalse() throws JacksonException {
    PlanFeatures features = jsonMapper.readValue("{\"storyAnalysis\":null}", PlanFeatures.class);

    assertFalse(features.storyAnalysisEnabled());
  }

  @Test
  void nestedStoryAnalysisDoesNotGrantTopLevelEntitlement() throws JacksonException {
    PlanFeatures features =
        jsonMapper.readValue(
            """
            {
              "metadata": {
                "storyAnalysis": true
              }
            }
            """,
            PlanFeatures.class);

    assertFalse(features.storyAnalysisEnabled());
  }
}
