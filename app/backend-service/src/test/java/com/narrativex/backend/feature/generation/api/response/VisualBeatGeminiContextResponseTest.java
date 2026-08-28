package com.narrativex.backend.feature.generation.api.response;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.application.service.VisualPromptComposer.ComposedVisualPrompt;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VisualBeatGeminiContextResponseTest {
  @Test
  void finalPromptIncludesBackendOwnedAvoidRules() {
    var response =
        VisualBeatGeminiContextResponse.from(
            UUID.randomUUID(),
            new ComposedVisualPrompt(
                "FINAL PROMPT", "photorealistic, watermark, collage", "{}", List.of()));

    assertThat(response.prompt())
        .isEqualTo("FINAL PROMPT\nAVOID: photorealistic, watermark, collage");
  }
}
