package com.narrativex.backend.feature.generation.application.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerateChapterNarrationCommandTest {
  @Test
  void normalNarrationKeepsPreviewDisabled() {
    var command =
        new GenerateChapterNarrationCommand(
            UUID.randomUUID(), UUID.randomUUID(), "vieneu-ngoc-huyen-v2", BigDecimal.ONE, null);

    assertThat(command.preview()).isFalse();
    assertThat(command.previewText()).isNull();
  }

  @Test
  void previewTrimsTextAndRequiresReferenceAsset() {
    UUID referenceAssetId = UUID.randomUUID();
    var command =
        new GenerateChapterNarrationCommand(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "vieneu-ngoc-huyen-v2",
            BigDecimal.ONE,
            referenceAssetId,
            "  Xin chào, đây là giọng mẫu.  ");

    assertThat(command.preview()).isTrue();
    assertThat(command.previewText()).isEqualTo("Xin chào, đây là giọng mẫu.");
    assertThat(command.voiceReferenceAssetId()).isEqualTo(referenceAssetId);
  }

  @Test
  void previewRejectsMissingReferenceAndOversizedText() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    assertThatThrownBy(
            () ->
                new GenerateChapterNarrationCommand(
                    projectId,
                    chapterId,
                    "vieneu-ngoc-huyen-v2",
                    BigDecimal.ONE,
                    null,
                    "Giọng mẫu"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("requires a voice reference");

    assertThatThrownBy(
            () ->
                new GenerateChapterNarrationCommand(
                    projectId,
                    chapterId,
                    "vieneu-ngoc-huyen-v2",
                    BigDecimal.ONE,
                    UUID.randomUUID(),
                    "a".repeat(501)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("500");
  }
}
