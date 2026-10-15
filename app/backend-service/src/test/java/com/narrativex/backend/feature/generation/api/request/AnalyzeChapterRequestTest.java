package com.narrativex.backend.feature.generation.api.request;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AnalyzeChapterRequestTest {

  @Test
  void videoAnalysisIntentRemainsSupported() {
    AnalyzeChapterRequest request = new AnalyzeChapterRequest("VIDEO", null);

    assertThat(request.effectiveVisualGenerationMode()).isEqualTo("VIDEO");
    assertThat(request.effectiveImageProvider()).isNull();
  }
}
