package com.narrativex.backend.feature.generation.application.command;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.narrativex.backend.feature.generation.application.model.VoiceReferenceSelection;
import com.narrativex.backend.feature.generation.domain.enums.VoiceReferenceScope;
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
    var reference = new VoiceReferenceSelection(VoiceReferenceScope.PROJECT, referenceAssetId);
    var command =
        new GenerateChapterNarrationCommand(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "vieneu-ngoc-huyen-v2",
            BigDecimal.ONE,
            reference,
            "  Xin chào, đây là giọng mẫu.  ");

    assertThat(command.preview()).isTrue();
    assertThat(command.previewText()).isEqualTo("Xin chào, đây là giọng mẫu.");
    assertThat(command.voiceReference()).isEqualTo(reference);
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
                    new VoiceReferenceSelection(VoiceReferenceScope.ACCOUNT, UUID.randomUUID()),
                    "a".repeat(501)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("500");
  }
}
