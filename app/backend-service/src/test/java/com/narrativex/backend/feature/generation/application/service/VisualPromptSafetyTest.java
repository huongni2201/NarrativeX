package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VisualPromptSafetyTest {

  @Test
  void softensSensitiveVietnameseSceneDescriptionsForImageGeneration() {
    String sanitized =
        VisualPromptSafety.sanitizeSceneDirection(
            "Lâm Vân Vân bị trói chặt trên giường, miệng bị bịt bằng vải trắng, máu chảy ở môi.");

    assertThat(sanitized)
        .contains("tình huống căng thẳng")
        .contains("không thể lên tiếng")
        .contains("dấu hiệu chấn thương nhẹ")
        .doesNotContain("trói chặt")
        .doesNotContain("bịt bằng vải trắng")
        .doesNotContain("máu chảy");
  }

  @Test
  void softensCommonEnglishHighRiskImagePhrasing() {
    String sanitized =
        VisualPromptSafety.sanitizeSceneDirection(
            "A tied up woman is gagged, bloody and naked after torture.");

    assertThat(sanitized)
        .contains("movement restricted in a tense situation")
        .contains("unable to speak")
        .contains("non-graphic sign of minor injury")
        .contains("appropriately clothed")
        .doesNotContain("tied up", "gagged", "bloody", "naked", "torture");
  }
}
